import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/db";
import { ensureDefaultProjectExists, slugifyProject } from "@/lib/projects";
import { ProjectModel } from "@/models/Project";
import { ServerModel } from "@/models/Server";
import { jsonError } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

function serializeProject(project: { _id: { toString(): string }; [key: string]: unknown }) {
  return { ...project, _id: project._id.toString() };
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return jsonError("Invalid id", 404);
  await connectDb();
  await ensureDefaultProjectExists();
  const project = await ProjectModel.findById(id).lean();
  if (!project) return jsonError("Not found", 404);
  return Response.json(serializeProject(project));
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return jsonError("Invalid id", 404);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonError("Invalid JSON");
  const { name, description, slug } = body;
  if (name !== undefined && (typeof name !== "string" || !name.trim())) return jsonError("name cannot be empty");
  if (slug !== undefined && (typeof slug !== "string" || !slug.trim())) return jsonError("slug cannot be empty");
  await connectDb();
  await ensureDefaultProjectExists();
  const project = await ProjectModel.findById(id);
  if (!project) return jsonError("Not found", 404);
  if (typeof name === "string") project.name = name.trim();
  if (typeof description === "string") project.description = description.trim();
  if (typeof slug === "string") {
    const normalizedSlug = slugifyProject(slug);
    if (normalizedSlug !== project.slug) {
      const existing = await ProjectModel.findOne({ slug: normalizedSlug, _id: { $ne: project._id } });
      if (existing) return jsonError("slug already exists", 409);
      project.slug = normalizedSlug;
    }
  }
  try {
    await project.save();
    return Response.json(serializeProject(project.toObject()));
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) return jsonError("slug already exists", 409);
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return jsonError("Invalid id", 404);
  await connectDb();
  await ensureDefaultProjectExists();
  const project = await ProjectModel.findById(id);
  if (!project) return jsonError("Not found", 404);
  if (project.isDefault) return jsonError("Default project cannot be deleted", 409);
  const serverCount = await ServerModel.countDocuments({ projectId: project._id });
  if (serverCount > 0) return jsonError("Project has servers", 409);
  await ProjectModel.findByIdAndDelete(project._id);
  return Response.json({ deleted: true });
}
