import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { StatusCheckModel } from "@/models/StatusCheck";
import { ServerModel } from "@/models/Server";
import { deleteScreenshot } from "@/lib/gridfs";
import { jsonError } from "@/lib/utils";
import mongoose from "mongoose";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return jsonError("Invalid id", 404);
  const searchParams = new URL(req.url).searchParams;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const status = searchParams.get("status");
  const since = searchParams.get("since");
  await connectDb();
  const query: Record<string, unknown> = { serverId: new mongoose.Types.ObjectId(id) };
  if (status && ["up", "degraded", "down"].includes(status)) query.status = status === "down" ? { $in: ["down", "not_found"] } : status;
  if (since) query.checkedAt = { $gte: new Date(since) };
  const checks = await StatusCheckModel.find(query).sort({ checkedAt: -1 }).limit(limit).lean();
  return Response.json(
    checks.map((c) => ({
      ...c,
      _id: c._id.toString(),
      serverId: c.serverId.toString(),
      screenshotFileId: c.screenshotFileId?.toString(),
    })),
  );
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return jsonError("Invalid id", 404);
  await connectDb();
  const server = await ServerModel.findById(id).lean();
  if (!server) return jsonError("Not found", 404);
  const checks = await StatusCheckModel.find({ serverId: id }, "screenshotFileId").lean();
  for (const check of checks) {
    if (check.screenshotFileId) await deleteScreenshot(new mongoose.Types.ObjectId(check.screenshotFileId.toString()));
  }
  await StatusCheckModel.deleteMany({ serverId: id });
  return Response.json({ deleted: checks.length });
}

