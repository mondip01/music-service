import { Schema, model, Types } from "mongoose";

export interface CategoryDoc {
  name: string;
  slug: string;
  description?: string | null;
  imageAssetId?: Types.ObjectId | null;
  position: number;
  group?: "DEVOTION" | "MOMENT" | "GENERAL";
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<CategoryDoc>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: null },
    imageAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    position: { type: Number, required: true, default: 0 },
    group: { type: String, enum: ["DEVOTION", "MOMENT", "GENERAL"], default: "GENERAL" },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true },
);

categorySchema.index({ status: 1, position: 1 });

export const Category = model<CategoryDoc>("Category", categorySchema);
