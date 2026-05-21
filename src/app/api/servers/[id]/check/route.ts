import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { ServerModel } from "@/models/Server";
import { checkServer } from "@/lib/checker";
import { jsonError } from "@/lib/utils";
import mongoose from "mongoose";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return jsonError("Invalid id", 404);
  await connectDb();
  const server = await ServerModel.findById(id);
  if (!server) return jsonError("Not found", 404);
  const check = await checkServer(server);
  return Response.json({
    ...check.toObject(),
    _id: check._id.toString(),
    serverId: check.serverId.toString(),
    screenshotFileId: check.screenshotFileId?.toString(),
  });
}
