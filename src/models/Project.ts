import mongoose, { Schema, models, model } from "mongoose";

export type ProjectDocument = mongoose.Document & {
  name: string;
  description?: string;
  slug: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const ProjectSchema = new Schema<ProjectDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    isDefault: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

ProjectSchema.index({ isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

export const ProjectModel = models.Project || model<ProjectDocument>("Project", ProjectSchema);
