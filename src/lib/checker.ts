import { connectDb } from "./db";
import { deleteScreenshot, saveScreenshot } from "./gridfs";
import { StatusCheckModel } from "@/models/StatusCheck";
import type { ServerDocument } from "@/models/Server";
import mongoose from "mongoose";
import type { Page } from "playwright";

const DEGRADED_THRESHOLD_MS = 5000;
const TIMEOUT_MS = 30000;
const SCREENSHOT_SETTLE_MS = 5000;
const SCREENSHOT_VIEWPORT = { width: 1280, height: 800 };
const SCREENSHOT_QUALITY = parseInt(process.env.SCREENSHOT_QUALITY ?? "70", 10);
const PARTLY_ERROR_RATIO = 0.2;

function routeUrl(server: Pick<ServerDocument, "url">, route?: string) {
  const path = route?.trim();
  if (!path) return server.url;
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, server.url).toString();
}
function healthUrl(server: Pick<ServerDocument, "url" | "healthRoute">) {
  return routeUrl(server, server.healthRoute?.trim() || "/health");
}

function screenshotUrl(server: Pick<ServerDocument, "url" | "screenshotRoute">) {
  return routeUrl(server, server.screenshotRoute);
}

async function latestScreenshotFileId(serverId: mongoose.Types.ObjectId) {
  const latest = await StatusCheckModel.findOne({
    serverId,
    screenshotFileId: { $exists: true, $ne: null },
  })
    .sort({ checkedAt: -1 })
    .select("screenshotFileId")
    .lean();
  return latest?.screenshotFileId as mongoose.Types.ObjectId | undefined;
}

async function keepOnlyScreenshot(serverId: mongoose.Types.ObjectId, keepId?: mongoose.Types.ObjectId) {
  const checks = await StatusCheckModel.find({
    serverId,
    screenshotFileId: { $exists: true, $ne: null },
  })
    .select("screenshotFileId")
    .lean();
  const keep = keepId?.toString();
  const obsolete = new Set(
    checks
      .map((check) => check.screenshotFileId?.toString())
      .filter((id): id is string => Boolean(id) && id !== keep),
  );
  if (!obsolete.size) return;
  await StatusCheckModel.updateMany(
    { serverId, screenshotFileId: { $in: [...obsolete].map((id) => new mongoose.Types.ObjectId(id)) } },
    { $unset: { screenshotFileId: "" } },
  );
  for (const id of obsolete) await deleteScreenshot(new mongoose.Types.ObjectId(id));
}

async function keepOnlyLatestScreenshotRecord(serverId: mongoose.Types.ObjectId) {
  const latest = await StatusCheckModel.findOne({
    serverId,
    screenshotFileId: { $exists: true, $ne: null },
  })
    .sort({ checkedAt: -1 })
    .select("_id screenshotFileId")
    .lean();
  const keepId = latest?.screenshotFileId as mongoose.Types.ObjectId | undefined;
  await keepOnlyScreenshot(serverId, keepId);
  if (!latest) return;
  await StatusCheckModel.updateMany(
    { serverId, _id: { $ne: latest._id }, screenshotFileId: keepId },
    { $unset: { screenshotFileId: "" } },
  );
}

async function captureScreenshot(page: Page, server: ServerDocument & { _id: mongoose.Types.ObjectId }) {
  await page.goto(screenshotUrl(server), {
    waitUntil: "domcontentloaded",
    timeout: TIMEOUT_MS,
  });
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(SCREENSHOT_SETTLE_MS);
  const screenshotBuf = await page.screenshot({ fullPage: true, type: "jpeg", quality: SCREENSHOT_QUALITY });
  return saveScreenshot(
    `screenshot-${server._id}-${Date.now()}.jpg`,
    screenshotBuf,
    "image/jpeg",
  );
}

export async function checkServer(server: ServerDocument & { _id: mongoose.Types.ObjectId }) {
  await connectDb();
  const { chromium } = await import("playwright");
  let browser;
  const startTime = Date.now();
  let checkUrl = healthUrl(server);
  const hasCustomHealthRoute = Boolean(server.healthRoute?.trim());
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: SCREENSHOT_VIEWPORT });
    let httpStatus: number | undefined;
    let networkTotal = 0;
    let networkErrors = 0;
    page.on("response", (res) => {
      networkTotal += 1;
      if (res.status() >= 400) networkErrors += 1;
      if (res.url() === checkUrl && !httpStatus) httpStatus = res.status();
    });
    page.on("requestfailed", () => {
      networkTotal += 1;
      networkErrors += 1;
    });
    let response = await page.goto(checkUrl, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_MS,
    }).catch(() => null);
    let responseTimeMs = Date.now() - startTime;
    if (!httpStatus && response) httpStatus = response.status();
    if (!hasCustomHealthRoute && (!response || httpStatus === undefined || httpStatus >= 400)) {
      checkUrl = server.url;
      httpStatus = undefined;
      networkTotal = 0;
      networkErrors = 0;
      response = await page.goto(checkUrl, {
        waitUntil: "domcontentloaded",
        timeout: TIMEOUT_MS,
      });
      if (response) httpStatus = response.status();
      responseTimeMs = Date.now() - startTime;
    }
    const mainDocumentDown = httpStatus === undefined || httpStatus >= 400;
    const status = mainDocumentDown
      ? "down"
      : networkErrors === 0
        ? responseTimeMs >= DEGRADED_THRESHOLD_MS ? "degraded" : "up"
        : networkErrors / Math.max(networkTotal, 1) <= PARTLY_ERROR_RATIO ? "degraded" : "up";
    let fileId: Awaited<ReturnType<typeof saveScreenshot>> | undefined;
    try {
      fileId = await captureScreenshot(page, server);
    } catch {
      fileId = undefined;
    }
    const newCheck = await StatusCheckModel.create({
      serverId: server._id,
      url: checkUrl,
      status,
      httpStatus,
      responseTimeMs,
      error: networkErrors ? `${networkErrors}/${networkTotal} network requests failed` : undefined,
      screenshotFileId: fileId,
    });
    if (fileId && status !== "down") {
      await keepOnlyScreenshot(server._id, fileId);
      await StatusCheckModel.updateMany(
        { serverId: server._id, _id: { $ne: newCheck._id }, screenshotFileId: fileId },
        { $unset: { screenshotFileId: "" } },
      );
    }
    return newCheck;
  } catch (err) {
    const responseTimeMs = Date.now() - startTime;
    return await StatusCheckModel.create({
      serverId: server._id,
      url: checkUrl,
      status: "down",
      responseTimeMs,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await browser?.close();
  }
}










