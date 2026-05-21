import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { getScreenshot } from "@/lib/gridfs";
import mongoose from "mongoose";
import { jsonError } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return jsonError("Invalid id", 404);
  await connectDb();
  const result = await getScreenshot(new mongoose.Types.ObjectId(id));
  if (!result) return jsonError("Not found", 404);
  return new Response(new Uint8Array(result.buffer), {
    headers: { "Content-Type": result.contentType, "Cache-Control": "public, max-age=86400" },
  });
}
