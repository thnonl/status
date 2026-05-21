import { connectDb } from "./db";
import { saveScreenshot } from "./gridfs";
import { StatusCheckModel } from "@/models/StatusCheck";
import type { ServerDocument } from "@/models/Server";
import mongoose from "mongoose";

const DEGRADED_THRESHOLD_MS = 5000;
const TIMEOUT_MS = 30000;
const SCREENSHOT_SETTLE_MS = 5000;
const SCREENSHOT_VIEWPORT = { width: 1920, height: 1080 };
const PARTLY_ERROR_RATIO = 0.2;

function routeUrl(server: Pick<ServerDocument, "url">, route?: string) {
  const path = route?.trim();
  if (!path) return server.url;
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, server.url).toString();
}
function healthUrl(server: Pick<ServerDocument, "url" | "healthRoute">) {
  return routeUrl(server, server.healthRoute?.trim());
}

function screenshotUrl(server: Pick<ServerDocument, "url" | "screenshotRoute">) {
  return routeUrl(server, server.screenshotRoute);
}
export async function checkServer(server: ServerDocument & { _id: mongoose.Types.ObjectId }) {
  await connectDb();
  const { chromium } = await import("playwright");
  let browser;
  const startTime = Date.now();
  const checkUrl = healthUrl(server);
  const hasHealthRoute = Boolean(server.healthRoute?.trim());
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
    const response = await page.goto(checkUrl, {
      waitUntil: "networkidle",
      timeout: TIMEOUT_MS,
    });
    const responseTimeMs = Date.now() - startTime;
    if (!httpStatus && response) httpStatus = response.status();
    let fileId: Awaited<ReturnType<typeof saveScreenshot>> | undefined;
    try {
      await page.goto(screenshotUrl(server), {
        waitUntil: "domcontentloaded",
        timeout: TIMEOUT_MS,
      });
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(SCREENSHOT_SETTLE_MS);
      const screenshotBuf = await page.screenshot({ fullPage: true });
      fileId = await saveScreenshot(
        `screenshot-${server._id}-${Date.now()}.png`,
        screenshotBuf,
      );
    } catch {
      fileId = undefined;
    }
    const status = hasHealthRoute
      ? httpStatus && httpStatus >= 400 ? "down" : responseTimeMs >= DEGRADED_THRESHOLD_MS ? "degraded" : "up"
      : networkErrors === 0 ? "up" : networkErrors / Math.max(networkTotal, 1) <= PARTLY_ERROR_RATIO ? "degraded" : "down";
    return await StatusCheckModel.create({
      serverId: server._id,
      url: checkUrl,
      status,
      httpStatus,
      responseTimeMs,
      error: networkErrors ? `${networkErrors}/${networkTotal} network requests failed` : undefined,
      screenshotFileId: fileId,
    });
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

