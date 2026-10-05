import { Schema, model, Types } from "mongoose";

export interface PlaylistTrackDoc {
  playlistId: Types.ObjectId;
  trackId: Types.ObjectId;
  position: number;
  addedBy: string;
  addedAt: Date;
}

const playlistTrackSchema = new Schema<PlaylistTrackDoc>({
  playlistId: { type: Schema.Types.ObjectId, ref: "Playlist", required: true },
  trackId: { type: Schema.Types.ObjectId, ref: "Track", required: true },
  position: { type: Number, required: true },
  addedBy: { type: String, required: true },
  addedAt: { type: Date, default: () => new Date() },
});

playlistTrackSchema.index({ playlistId: 1, position: 1 });
playlistTrackSchema.index({ playlistId: 1, trackId: 1 }, { unique: true });

export const PlaylistTrack = model<PlaylistTrackDoc>("PlaylistTrack", playlistTrackSchema);
