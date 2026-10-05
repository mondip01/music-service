import { Schema, model, Types } from "mongoose";

export interface PlaylistDoc {
  userId: string;
  name: string;
  description?: string | null;
  coverAssetId?: Types.ObjectId | null;
  visibility: "PRIVATE" | "PUBLIC";
  trackCount: number;
  totalDurationSec: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const playlistSchema = new Schema<PlaylistDoc>(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    coverAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    visibility: { type: String, enum: ["PRIVATE", "PUBLIC"], default: "PRIVATE" },
    trackCount: { type: Number, default: 0 },
    totalDurationSec: { type: Number, default: 0 },
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);

playlistSchema.index({ userId: 1, updatedAt: -1 });

export const Playlist = model<PlaylistDoc>("Playlist", playlistSchema);
