import { HomeSection, type HomeContentType } from "../models/home.models";

export const homeRepository = {
  findEnabled: () => HomeSection.find({ enabled: true }).sort({ position: 1 }).lean(),
  findAll: () => HomeSection.find().sort({ position: 1 }).lean(),
  findById: (id: string) => HomeSection.findById(id).lean(),
  create: (doc: any) => HomeSection.create(doc),
  update: (id: string, patch: any) => HomeSection.findByIdAndUpdate(id, patch, { new: true }).lean(),
  remove: (id: string) => HomeSection.deleteOne({ _id: id }),
  normalizeItems(items: Array<{ type: HomeContentType; refId: string; position?: number }>) {
    return items.map((item, index) => ({
      type: item.type,
      refId: item.refId,
      position: item.position ?? index,
    }));
  },
};
