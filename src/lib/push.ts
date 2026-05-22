import webpush from "web-push";
import mongoose from "mongoose";
import { connectDb } from "./db";
import { PushSubscriptionModel } from "@/models/PushSubscription";
import { ServerModel } from "@/models/Server";
import type { StatusCheckDocument } from "@/models/StatusCheck";

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY || "";
}

export function canSendPush() {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

function configureWebPush() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return true;
}

export async function notifyServerDown(check: StatusCheckDocument) {
  if (check.status !== "down" || !configureWebPush()) return;
  await connectDb();
  const server = await ServerModel.findById(check.serverId).lean();
  if (!server) return;

  const projectId = server.projectId?.toString();
  const subscriptions = await PushSubscriptionModel.find({
    $or: [
      { projectId: new mongoose.Types.ObjectId(projectId) },
      { projectId: { $exists: false } },
      { projectId: null },
    ],
  }).lean();

  const payload = JSON.stringify({
    title: `Server down: ${server.name}`,
    body: `${server.url}${check.checkedAt ? ` • ${new Date(check.checkedAt).toLocaleString()}` : ""}`,
    url: `/servers/${server._id.toString()}?project=${projectId}`,
    tag: `${server._id.toString()}_${check._id.toString()}`,
    icon: "/favicon.ico",
  });

  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, payload);
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await PushSubscriptionModel.deleteOne({ endpoint: subscription.endpoint });
      } else {
        console.error("[push] send failed", err);
      }
    }
  }));
}
