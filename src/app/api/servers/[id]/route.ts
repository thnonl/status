import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { ServerModel } from "@/models/Server";
import { StatusCheckModel } from "@/models/StatusCheck";
import { deleteScreenshot } from "@/lib/gridfs";
import { ensureDefaultProjectExists, resolveProjectScope } from "@/lib/projects";
import { isValidHttpUrl, normalizeTags, jsonError } from "@/lib/utils";
import mongoose from "mongoose";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return jsonError("Invalid id", 404);
  await connectDb();
  await ensureDefaultProjectExists();
  const server = await ServerModel.findById(id).lean();
  if (!server) return jsonError("Not found", 404);
  const scopeProjectId = new URL(_req.url).searchParams.get("projectId");
  if (scopeProjectId) {
    if (!mongoose.isValidObjectId(scopeProjectId)) return jsonError("Invalid projectId", 404);
    if (server.projectId?.toString() !== scopeProjectId) return jsonError("Not found", 404);
  }
  const latest = await StatusCheckModel.findOne({ serverId: server._id }).sort({ checkedAt: -1 }).lean();
  const now = Date.now();
  async function uptime(since: Date): Promise<number | null> {
    const checks = await StatusCheckModel.find({ serverId: server._id, checkedAt: { $gte: since } }, "status").lean();
    if (!checks.length) return null;
    const up = checks.filter((check) => check.status === "up" || check.status === "degraded").length;
    return Math.round((up / checks.length) * 1000) / 10;
  }
  const [uptime24h, uptime10d] = await Promise.all([
    uptime(new Date(now - 86400_000)),
    uptime(new Date(now - 10 * 86400_000)),
  ]);
  return Response.json({
    ...server,
    _id: server._id.toString(),
    projectId: server.projectId.toString(),
    latestCheck: latest
      ? {
          ...latest,
          _id: latest._id.toString(),
          serverId: latest.serverId.toString(),
          screenshotFileId: latest.screenshotFileId?.toString(),
        }
      : null,
    uptime24h,
    uptime10d,
  });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return jsonError("Invalid id", 404);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON");
  const { name, url, healthRoute, screenshotRoute, description, tags, enabled, projectId } = body;
  if (name !== undefined && (typeof name !== "string" || !name.trim())) return jsonError("name cannot be empty");
  if (url !== undefined && (typeof url !== "string" || !isValidHttpUrl(url))) return jsonError("url must be valid http/https");
  if (healthRoute !== undefined && typeof healthRoute !== "string") return jsonError("healthRoute must be a string");
  if (screenshotRoute !== undefined && typeof screenshotRoute !== "string") return jsonError("screenshotRoute must be a string");
  if (projectId !== undefined && typeof projectId !== "string") return jsonError("projectId must be a valid id", 404);
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = (name as string).trim();
  if (url !== undefined) update.url = (url as string).trim();
  if (healthRoute !== undefined) update.healthRoute = (healthRoute as string).trim();
  if (screenshotRoute !== undefined) update.screenshotRoute = (screenshotRoute as string).trim();
  if (description !== undefined) update.description = (description as string).trim();
  if (tags !== undefined) update.tags = normalizeTags(tags);
  if (enabled !== undefined) update.enabled = Boolean(enabled);
  await connectDb();
  await ensureDefaultProjectExists();
  const current = await ServerModel.findById(id);
  if (!current) return jsonError("Not found", 404);
  const scopeProjectId = new URL(req.url).searchParams.get("projectId");
  if (scopeProjectId) {
    if (!mongoose.isValidObjectId(scopeProjectId)) return jsonError("Invalid projectId", 404);
    if (current.projectId?.toString() !== scopeProjectId) return jsonError("Not found", 404);
  }
  if (projectId !== undefined) {
    const resolvedProject = await resolveProjectScope(projectId);
    if (!resolvedProject) return jsonError("Invalid projectId", 404);
    update.projectId = resolvedProject._id;
  }
  try {
    const doc = await ServerModel.findByIdAndUpdate(id, update, { new: true });
    if (!doc) return jsonError("Not found", 404);
    return Response.json({ ...doc.toObject(), _id: doc._id.toString(), projectId: doc.projectId.toString() });
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) return jsonError("URL already exists in this project", 409);
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return jsonError("Invalid id", 404);
  await connectDb();
  await ensureDefaultProjectExists();
  const server = await ServerModel.findById(id);
  if (!server) return jsonError("Not found", 404);
  const scopeProjectId = new URL(_req.url).searchParams.get("projectId");
  if (scopeProjectId) {
    if (!mongoose.isValidObjectId(scopeProjectId)) return jsonError("Invalid projectId", 404);
    if (server.projectId?.toString() !== scopeProjectId) return jsonError("Not found", 404);
  }
  const checks = await StatusCheckModel.find({ serverId: id }, "screenshotFileId").lean();
  for (const check of checks) {
    if (check.screenshotFileId) {
      await deleteScreenshot(new mongoose.Types.ObjectId(check.screenshotFileId.toString()));
    }
  }
  await StatusCheckModel.deleteMany({ serverId: id });
  const doc = await ServerModel.findByIdAndDelete(id);
  if (!doc) return jsonError("Not found", 404);
  return Response.json({ deleted: true });
}
