import { Schema, model, Types } from "mongoose";

export interface TrackLikeDoc {
  userId: string;
  trackId: Types.ObjectId;
  createdAt: Date;
}

const trackLikeSchema = new Schema<TrackLikeDoc>(
  {
    userId: { type: String, required: true },
    trackId: { type: Schema.Types.ObjectId, ref: "Track", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

trackLikeSchema.index({ userId: 1, trackId: 1 }, { unique: true });

export const TrackLike = model<TrackLikeDoc>("TrackLike", trackLikeSchema);
