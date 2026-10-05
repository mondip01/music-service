import { Schema, model, Types } from "mongoose";

export interface PlaybackProgressDoc {
  userId: string;
  trackId: Types.ObjectId;
  positionSec: number;
  durationSec: number;
  completed: boolean;
  version: number;
  updatedAt: Date;
}

const playbackProgressSchema = new Schema<PlaybackProgressDoc>(
  {
    userId: { type: String, required: true },
    trackId: { type: Schema.Types.ObjectId, ref: "Track", required: true },
    positionSec: { type: Number, required: true, default: 0 },
    durationSec: { type: Number, required: true },
    completed: { type: Boolean, required: true, default: false },
    version: { type: Number, required: true, default: 1 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

playbackProgressSchema.index({ userId: 1, trackId: 1 }, { unique: true });

export const PlaybackProgress = model<PlaybackProgressDoc>("PlaybackProgress", playbackProgressSchema);
