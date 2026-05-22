import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { PushSubscriptionModel } from "@/models/PushSubscription";

type PushSubscriptionBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  projectId?: string;
};

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as PushSubscriptionBody | null;
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) return jsonError("Invalid subscription");
  if (body.projectId && !mongoose.isValidObjectId(body.projectId)) return jsonError("Invalid projectId");
  await connectDb();
  await PushSubscriptionModel.findOneAndUpdate(
    { endpoint: body.endpoint },
    {
      endpoint: body.endpoint,
      keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
      ...(body.projectId ? { projectId: new mongoose.Types.ObjectId(body.projectId) } : {}),
    },
    { upsert: true, new: true },
  );
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return jsonError("Invalid subscription");
  await connectDb();
  await PushSubscriptionModel.deleteOne({ endpoint: body.endpoint });
  return Response.json({ ok: true });
}
