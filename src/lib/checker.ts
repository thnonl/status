import { connectDb } from "./db";
import { saveScreenshot } from "./gridfs";
import { StatusCheckModel } from "@/models/StatusCheck";
import type { ServerDocument } from "@/models/Server";
import mongoose from "mongoose";

const DEGRADED_THRESHOLD_MS = 5000;
const TIMEOUT_MS = 30000;
const SCREENSHOT_VIEWPORT = { width: 1920, height: 1080 };

function healthUrl(server: Pick<ServerDocument, "url" | "healthRoute">) {
  const base = new URL(server.url);
  const route = server.healthRoute?.trim() || "/health";
  base.pathname = route.startsWith("/") ? route : `/${route}`;
  base.search = "";
  base.hash = "";
  return base.toString();
}

export async function checkServer(server: ServerDocument & { _id: mongoose.Types.ObjectId }) {
  await connectDb();
  const { chromium } = await import("playwright");
  let browser;
  const startTime = Date.now();
  const checkUrl = healthUrl(server);
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: SCREENSHOT_VIEWPORT });
    let httpStatus: number | undefined;
    page.on("response", (res) => {
      if (res.url() === checkUrl && !httpStatus) httpStatus = res.status();
    });
    const response = await page.goto(checkUrl, {
      waitUntil: "networkidle",
      timeout: TIMEOUT_MS,
    });
    const responseTimeMs = Date.now() - startTime;
    if (!httpStatus && response) httpStatus = response.status();
    const screenshotBuf = await page.screenshot({ fullPage: true });
    const fileId = await saveScreenshot(
      `screenshot-${server._id}-${Date.now()}.png`,
      screenshotBuf,
    );
    const status = responseTimeMs >= DEGRADED_THRESHOLD_MS ? "degraded" : "up";
    await StatusCheckModel.create({
      serverId: server._id,
      url: checkUrl,
      status,
      httpStatus,
      responseTimeMs,
      screenshotFileId: fileId,
    });
  } catch (err) {
    const responseTimeMs = Date.now() - startTime;
    await StatusCheckModel.create({
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
