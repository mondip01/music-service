import { Schema, model, Types } from "mongoose";

export interface ArtistDoc {
  name: string;
  slug: string;
  bio?: string | null;
  imageAssetId?: Types.ObjectId | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}

const artistSchema = new Schema<ArtistDoc>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    bio: { type: String, default: null },
    imageAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true },
);

artistSchema.index({ status: 1, name: 1 });

export const Artist = model<ArtistDoc>("Artist", artistSchema);
