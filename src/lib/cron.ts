import cron from "node-cron";
import mongoose from "mongoose";

declare global {
  var __cronInitialized: boolean | undefined;
}

export function initCron() {
  if (globalThis.__cronInitialized) return;

  // Skip auto cron in local development
  if (process.env.NODE_ENV === "development") {
    console.log("[cron] Skipped in development mode");
    return;
  }
  globalThis.__cronInitialized = true;

  const intervalMinutes = parseInt(process.env.CHECK_INTERVAL_MINUTES ?? "30", 10);
  const retentionDays = parseInt(process.env.RETENTION_DAYS ?? "7", 10);
  const cronExpr = `*/${intervalMinutes} * * * *`;

  cron.schedule(cronExpr, async () => {
    const { connectDb } = await import("./db");
    const { ServerModel } = await import("@/models/Server");
    const { checkServer } = await import("./checker");
    await connectDb();
    const { notifyServerDown } = await import("./push");
    const servers = await ServerModel.find({ enabled: true }).lean();
    for (const server of servers) {
      checkServer(server as Parameters<typeof checkServer>[0])
        .then((check) => { if (check.status === "down") notifyServerDown(check).catch(console.error); })
        .catch(console.error);
    }
  });

  cron.schedule("0 2 * * *", async () => {
    const { connectDb } = await import("./db");
    const { StatusCheckModel } = await import("@/models/StatusCheck");
    const { deleteScreenshot } = await import("./gridfs");
    await connectDb();
    const cutoff = new Date(Date.now() - retentionDays * 86400_000);
    const old = await StatusCheckModel.find({ checkedAt: { $lt: cutoff } }, "screenshotFileId").lean();
    for (const check of old) {
      if (check.screenshotFileId) {
        await deleteScreenshot(new mongoose.Types.ObjectId(String(check.screenshotFileId)));
      }
    }
    await StatusCheckModel.deleteMany({ checkedAt: { $lt: cutoff } });
    console.log(`[cleanup] Deleted ${old.length} old checks older than ${retentionDays} days`);
  });

  console.log(`[cron] Initialized: check every ${intervalMinutes}m, cleanup daily at 02:00`);
}

