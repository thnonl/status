export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return (tags as unknown[]).map(String).map((t) => t.trim()).filter(Boolean);
  if (typeof tags === "string") return tags.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
