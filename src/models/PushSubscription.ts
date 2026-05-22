import mongoose, { Schema, models, model } from "mongoose";

export type PushSubscriptionDocument = mongoose.Document & {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  projectId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const PushSubscriptionSchema = new Schema<PushSubscriptionDocument>(
  {
    endpoint: { type: String, required: true, unique: true, index: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", index: true },
  },
  { timestamps: true },
);

export const PushSubscriptionModel = models.PushSubscription || model<PushSubscriptionDocument>("PushSubscription", PushSubscriptionSchema);
