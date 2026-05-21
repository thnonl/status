import mongoose from "mongoose";

export async function saveScreenshot(
  filename: string,
  buffer: Buffer,
  contentType = "image/png",
): Promise<mongoose.Types.ObjectId> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("DB not connected");
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "screenshots" });
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, { metadata: { contentType } });
    uploadStream.on("error", reject);
    uploadStream.on("finish", () => resolve(uploadStream.id as mongoose.Types.ObjectId));
    uploadStream.end(buffer);
  });
}

export async function deleteScreenshot(fileId: mongoose.Types.ObjectId) {
  const db = mongoose.connection.db;
  if (!db) return;
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "screenshots" });
  try {
    await bucket.delete(fileId);
  } catch {
    // ignore if already deleted
  }
}

export async function getScreenshot(
  fileId: mongoose.Types.ObjectId,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const db = mongoose.connection.db;
  if (!db) return null;
  const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "screenshots" });
  const files = await bucket.find({ _id: fileId }).toArray();
  if (!files.length) return null;
  const contentType = (files[0].metadata as Record<string, string> | null)?.contentType ?? "image/png";
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = bucket.openDownloadStream(fileId);
    stream.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on("error", reject);
    stream.on("end", () => resolve({ buffer: Buffer.concat(chunks), contentType }));
  });
}
