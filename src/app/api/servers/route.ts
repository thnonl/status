import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { ServerModel } from "@/models/Server";
import { StatusCheckModel } from "@/models/StatusCheck";
import { initCron } from "@/lib/cron";
import { isValidHttpUrl, normalizeTags, jsonError } from "@/lib/utils";
import { resolveProjectScope } from "@/lib/projects";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "test") initCron();
  await connectDb();
  const projectId = new URL(req.url).searchParams.get("projectId");
  const project = await resolveProjectScope(projectId);
  if (!project) return jsonError("Invalid projectId", 404);

  const servers = await ServerModel.find({ projectId: project._id }).sort({ createdAt: -1 }).lean();
  const ids = servers.map((s) => s._id);

  const latestChecks = await StatusCheckModel.aggregate([
    { $match: { serverId: { $in: ids } } },
    { $sort: { checkedAt: -1 } },
    { $group: { _id: "$serverId", doc: { $first: "$$ROOT" } } },
  ]);
  const latestMap = Object.fromEntries(latestChecks.map((x) => [x._id.toString(), x.doc]));

  const now = Date.now();
  const h24 = new Date(now - 86400_000);
  const d10 = new Date(now - 10 * 86400_000);

  async function uptime(serverId: mongoose.Types.ObjectId, since: Date): Promise<number | null> {
    const checks = await StatusCheckModel.find({ serverId, checkedAt: { $gte: since } }, "status").lean();
    if (!checks.length) return null;
    const up = checks.filter((c) => c.status !== "down").length;
    return Math.round((up / checks.length) * 1000) / 10;
  }

  const result = await Promise.all(
    servers.map(async (s) => {
      const latest = latestMap[s._id.toString()] ?? null;
      const [u24, u10] = await Promise.all([
        uptime(s._id as mongoose.Types.ObjectId, h24),
        uptime(s._id as mongoose.Types.ObjectId, d10),
      ]);
      return {
        ...s,
        _id: s._id.toString(),
        projectId: s.projectId.toString(),
        latestCheck: latest
          ? {
              ...latest,
              _id: latest._id.toString(),
              serverId: latest.serverId.toString(),
              screenshotFileId: latest.screenshotFileId?.toString(),
            }
          : null,
        uptime24h: u24,
        uptime10d: u10,
      };
    }),
  );
  return Response.json(result);
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "test") initCron();
  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON");
  const { name, url, healthRoute, description, tags, enabled, projectId } = body as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim()) return jsonError("name is required");
  if (typeof url !== "string" || !isValidHttpUrl(url)) return jsonError("url must be a valid http/https URL");
  if (healthRoute !== undefined && typeof healthRoute !== "string") return jsonError("healthRoute must be a string");
  if (projectId !== undefined && typeof projectId !== "string") return jsonError("projectId must be a valid id", 404);
  await connectDb();
  const project = await resolveProjectScope(typeof projectId === "string" ? projectId : null);
  if (!project) return jsonError("Invalid projectId", 404);
  try {
    const doc = await ServerModel.create({
      projectId: project._id,
      name: name.trim(),
      url: url.trim(),
      healthRoute: typeof healthRoute === "string" ? healthRoute.trim() : "",
      description: typeof description === "string" ? description.trim() : "",
      tags: normalizeTags(tags),
      enabled: enabled !== false,
    });
    return Response.json(
      {
        ...doc.toObject(),
        _id: doc._id.toString(),
        projectId: doc.projectId.toString(),
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) return jsonError("URL already exists in this project", 409);
    throw err;
  }
}

