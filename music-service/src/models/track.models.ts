import { Schema, model, Types } from "mongoose";

export interface TrackDoc {
  title: string;
  artistIds: Types.ObjectId[];
  albumId?: Types.ObjectId | null;
  categoryIds: Types.ObjectId[];
  mediaAssetId: Types.ObjectId;
  coverAssetId?: Types.ObjectId | null;
  thumbnailAssetId?: Types.ObjectId | null;
  durationSec: number;
  position?: number | null;
  status: "DRAFT" | "PROCESSING" | "READY" | "PUBLISHED" | "UNPUBLISHED";
  playCount: number;
  isFeatured: boolean;
  isTrending: boolean;
  isRecommended: boolean;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const trackSchema = new Schema<TrackDoc>(
  {
    title: { type: String, required: true },
    artistIds: [{ type: Schema.Types.ObjectId, ref: "Artist", required: true }],
    albumId: { type: Schema.Types.ObjectId, ref: "Album", default: null },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    mediaAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", required: true },
    coverAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    thumbnailAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    durationSec: { type: Number, required: true, default: 0 },
    position: { type: Number, default: null },
    status: {
      type: String,
      enum: ["DRAFT", "PROCESSING", "READY", "PUBLISHED", "UNPUBLISHED"],
      default: "DRAFT",
    },
    playCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
    isRecommended: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

trackSchema.index({ status: 1, publishedAt: -1 });
trackSchema.index({ albumId: 1, position: 1 });
trackSchema.index({ categoryIds: 1, publishedAt: -1 });
trackSchema.index({ isFeatured: 1 });
trackSchema.index({ isTrending: 1 });

export const Track = model<TrackDoc>("Track", trackSchema);
