import mongoose from "mongoose";
import { connectDb } from "./db";
import { ProjectModel, type ProjectDocument } from "@/models/Project";
import { ServerModel } from "@/models/Server";

export const DEFAULT_PROJECT_SLUG = "default";

export function slugifyProject(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "project";
}

export async function ensureDefaultProjectExists(): Promise<ProjectDocument> {
  await connectDb();
  let project = await ProjectModel.findOne({ slug: DEFAULT_PROJECT_SLUG });
  project ??= await ProjectModel.findOne({ isDefault: true }).sort({ createdAt: 1 });

  if (!project) {
    project = await ProjectModel.create({
      name: "Default",
      description: "",
      slug: DEFAULT_PROJECT_SLUG,
      isDefault: true,
    });
  } else {
    const duplicateDefaults = await ProjectModel.find({
      _id: { $ne: project._id },
      $or: [{ isDefault: true }, { slug: DEFAULT_PROJECT_SLUG }],
    });

    for (const duplicate of duplicateDefaults) {
      await ServerModel.updateMany({ projectId: duplicate._id }, { $set: { projectId: project._id } });
      await ProjectModel.findByIdAndDelete(duplicate._id);
    }

    project.name = project.name || "Default";
    project.slug = DEFAULT_PROJECT_SLUG;
    project.isDefault = true;
    await project.save();
  }

  await ServerModel.updateMany(
    { $or: [{ projectId: { $exists: false } }, { projectId: null }] },
    { $set: { projectId: project._id } },
  );

  return project;
}

export async function resolveProjectScope(projectId: string | null | undefined): Promise<ProjectDocument | null> {
  if (projectId == null) return ensureDefaultProjectExists();
  if (!projectId.trim()) return null;
  if (!mongoose.isValidObjectId(projectId)) return null;
  await connectDb();
  return ProjectModel.findById(projectId);
}

export async function reserveProjectSlug(name: string, slug?: string): Promise<string | null> {
  await connectDb();
  const baseSlug = slugifyProject(slug ?? name);
  if (slug) {
    const exists = await ProjectModel.exists({ slug: baseSlug });
    return exists ? null : baseSlug;
  }

  let candidate = baseSlug;
  let suffix = 2;
  while (await ProjectModel.exists({ slug: candidate })) {
    candidate = `${baseSlug}-${suffix++}`;
  }
  return candidate;
}
