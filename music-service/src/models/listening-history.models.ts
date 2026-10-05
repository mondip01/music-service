import { Schema, model, Types } from "mongoose";

export type PlaybackContextType = "HOME" | "ALBUM" | "PLAYLIST" | "SEARCH" | "QUEUE" | "OTHER";

export interface ListeningHistoryDoc {
  userId: string;
  trackId: Types.ObjectId;
  sessionId: string;
  contextType: PlaybackContextType;
  contextId?: string | null;
  startedAt: Date;
  playedSec: number;
  completed: boolean;
  createdAt: Date;
}

const listeningHistorySchema = new Schema<ListeningHistoryDoc>(
  {
    userId: { type: String, required: true },
    trackId: { type: Schema.Types.ObjectId, ref: "Track", required: true },
    sessionId: { type: String, required: true },
    contextType: {
      type: String,
      enum: ["HOME", "ALBUM", "PLAYLIST", "SEARCH", "QUEUE", "OTHER"],
      required: true,
    },
    contextId: { type: String, default: null },
    startedAt: { type: Date, required: true },
    playedSec: { type: Number, required: true, default: 0 },
    completed: { type: Boolean, required: true, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

listeningHistorySchema.index({ userId: 1, createdAt: -1 });

export const ListeningHistory = model<ListeningHistoryDoc>("ListeningHistory", listeningHistorySchema);
