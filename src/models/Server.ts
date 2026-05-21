import mongoose, { Schema, models, model } from "mongoose";

export type ServerDocument = mongoose.Document & {
  projectId: mongoose.Types.ObjectId;
  name: string;
  url: string;
  healthRoute?: string;
  screenshotRoute?: string;
  description?: string;
  tags: string[];
  enabled: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

const ServerSchema = new Schema<ServerDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    healthRoute: { type: String, default: "", trim: true },
    screenshotRoute: { type: String, default: "", trim: true },
    description: { type: String, default: "" },
    tags: { type: [String], default: [] },
    enabled: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

ServerSchema.index({ projectId: 1, url: 1 }, { unique: true });
ServerSchema.index({ projectId: 1, displayOrder: 1, createdAt: -1 });

export const ServerModel = models.Server || model<ServerDocument>("Server", ServerSchema);
