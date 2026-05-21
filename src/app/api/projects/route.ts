import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { ensureDefaultProjectExists, reserveProjectSlug } from "@/lib/projects";
import { ProjectModel } from "@/models/Project";
import { jsonError } from "@/lib/utils";

function serializeProject(project: { _id: { toString(): string }; [key: string]: unknown }) {
  return { ...project, _id: project._id.toString() };
}

export async function GET() {
  await ensureDefaultProjectExists();
  const projects = await ProjectModel.find().sort({ isDefault: -1, createdAt: 1 }).lean();
  return Response.json(projects.map(serializeProject));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Invalid JSON");
  const { name, description, slug } = body as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim()) return jsonError("name is required");
  await connectDb();
  await ensureDefaultProjectExists();
  const resolvedSlug = await reserveProjectSlug(
    name.trim(),
    typeof slug === "string" && slug.trim() ? slug.trim() : undefined,
  );
  if (!resolvedSlug) return jsonError("slug already exists", 409);
  try {
    const doc = await ProjectModel.create({
      name: name.trim(),
      description: typeof description === "string" ? description.trim() : "",
      slug: resolvedSlug,
      isDefault: false,
    });
    return Response.json(serializeProject(doc.toObject()), { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) return jsonError("slug already exists", 409);
    throw err;
  }
}
