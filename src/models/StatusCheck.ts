import mongoose, { Schema, models, model } from "mongoose";

export type StatusCheckDocument = mongoose.Document & {
  serverId: mongoose.Types.ObjectId;
  url: string;
  status: "up" | "degraded" | "down";
  httpStatus?: number;
  responseTimeMs?: number;
  error?: string;
  screenshotFileId?: mongoose.Types.ObjectId;
  checkedAt: Date;
};

const StatusCheckSchema = new Schema<StatusCheckDocument>({
  serverId: { type: Schema.Types.ObjectId, ref: "Server", required: true, index: true },
  url: { type: String, required: true },
  status: { type: String, enum: ["up", "degraded", "down"], required: true, index: true },
  httpStatus: Number,
  responseTimeMs: Number,
  error: String,
  screenshotFileId: Schema.Types.ObjectId,
  checkedAt: { type: Date, default: Date.now, index: true },
});

export const StatusCheckModel = models.StatusCheck || model<StatusCheckDocument>("StatusCheck", StatusCheckSchema);
