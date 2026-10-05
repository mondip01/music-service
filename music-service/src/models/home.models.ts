import { Schema, model, Types } from "mongoose";

export type HomeContentType = "TRACK" | "ALBUM" | "PLAYLIST" | "CATEGORY" | "ARTIST";
export type HomeLayout = "GRID_2" | "HORIZONTAL" | "GRID_2_LARGE" | "BANNER" | "LIST";

export interface HomeSectionItemDoc {
  type: HomeContentType;
  refId: Types.ObjectId;
  position: number;
}

export interface HomeSectionDoc {
  key: string;
  title: string;
  subtitle?: string | null;
  layout: HomeLayout;
  position: number;
  enabled: boolean;
  items: HomeSectionItemDoc[];
  createdAt: Date;
  updatedAt: Date;
}

const homeSectionItemSchema = new Schema<HomeSectionItemDoc>(
  {
    type: { type: String, enum: ["TRACK", "ALBUM", "PLAYLIST", "CATEGORY", "ARTIST"], required: true },
    refId: { type: Schema.Types.ObjectId, required: true },
    position: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const homeSectionSchema = new Schema<HomeSectionDoc>(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true },
    subtitle: { type: String, default: null },
    layout: { type: String, enum: ["GRID_2", "HORIZONTAL", "GRID_2_LARGE", "BANNER", "LIST"], default: "HORIZONTAL" },
    position: { type: Number, required: true, default: 0 },
    enabled: { type: Boolean, default: true },
    items: { type: [homeSectionItemSchema], default: [] },
  },
  { timestamps: true },
);

homeSectionSchema.index({ enabled: 1, position: 1 });

export const HomeSection = model<HomeSectionDoc>("HomeSection", homeSectionSchema);
