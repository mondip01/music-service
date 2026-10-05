import { MediaAsset } from "../models/media-asset.models";

export const mediaRepository = {
  create: (doc: Partial<import("../models/media-asset.models").MediaAssetDoc>) => MediaAsset.create(doc),

  findById: (id: string) => MediaAsset.findById(id),

  async markStatus(id: string, status: string, patch: Record<string, unknown> = {}) {
    await MediaAsset.updateOne({ _id: id }, { $set: { status, ...patch } });
  },

  async attachOwner(id: string, ownerId: string) {
    const result = await MediaAsset.updateOne(
      { _id: id, $or: [{ ownerId: null }, { ownerId: { $exists: false } }, { ownerId }] },
      { $set: { ownerId } },
    );
    if (result.matchedCount === 0) throw new Error("Media asset attachment race detected");
  },
};
