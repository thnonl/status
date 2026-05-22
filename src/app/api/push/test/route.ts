import { NextRequest } from "next/server";
import webpush from "web-push";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { PushSubscriptionModel } from "@/models/PushSubscription";

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return jsonError("VAPID not configured", 500);
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const body = (await req.json().catch(() => null)) as { projectId?: string } | null;
  if (body?.projectId && !mongoose.isValidObjectId(body.projectId)) return jsonError("Invalid projectId");

  await connectDb();
  const query = body?.projectId
    ? { projectId: new mongoose.Types.ObjectId(body.projectId) }
    : { $or: [{ projectId: { $exists: false } }, { projectId: null }] };
  const subscriptions = await PushSubscriptionModel.find(query).lean();

  if (subscriptions.length === 0) return jsonError("No subscriptions found", 404);

  const payload = JSON.stringify({
    title: "Test Notification",
    body: `Sent at ${new Date().toLocaleString()}`,
    url: "/",
    tag: `test_${Date.now()}`,
    icon: "/favicon.ico",
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, payload);
      sent++;
    } catch (err) {
      failed++;
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await PushSubscriptionModel.deleteOne({ endpoint: subscription.endpoint });
      }
    }
  }));

  return Response.json({ sent, failed, total: subscriptions.length });
}
