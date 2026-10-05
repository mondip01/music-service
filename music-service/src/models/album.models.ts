import { Schema, model, Types } from "mongoose";

export interface AlbumDoc {
  title: string;
  artistIds: Types.ObjectId[];
  coverAssetId?: Types.ObjectId | null;
  description?: string | null;
  categoryIds: Types.ObjectId[];
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED";
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const albumSchema = new Schema<AlbumDoc>(
  {
    title: { type: String, required: true },
    artistIds: [{ type: Schema.Types.ObjectId, ref: "Artist", required: true }],
    coverAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    description: { type: String, default: null },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    status: { type: String, enum: ["DRAFT", "PUBLISHED", "UNPUBLISHED"], default: "DRAFT" },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

albumSchema.index({ status: 1, publishedAt: -1 });
albumSchema.index({ artistIds: 1 });

export const Album = model<AlbumDoc>("Album", albumSchema);
