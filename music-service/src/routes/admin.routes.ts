import { Router } from "express";
import { z } from "zod";
import { adminController } from "../controllers/admin.controller";
import { requireAuth } from "../middlewares/authMiddleware";
import { requireAdmin } from "../middlewares/rbac";
import { validate } from "../validators/validate";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const assetId = objectId.nullable().optional();

const homeItem = z.object({
  type: z.enum(["TRACK", "ALBUM", "PLAYLIST", "CATEGORY", "ARTIST"]),
  refId: objectId,
  position: z.number().int().min(0).optional(),
});

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.post(
  "/admin/artists",
  validate({ body: z.object({
    name: z.string().min(1).max(200),
    slug: z.string().min(1).max(220),
    bio: z.string().max(5000).nullable().optional(),
    imageAssetId: assetId,
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  }) }),
  adminController.createArtist,
);
adminRouter.patch(
  "/admin/artists/:id",
  validate({ body: z.object({
    name: z.string().min(1).max(200).optional(),
    slug: z.string().min(1).max(220).optional(),
    bio: z.string().max(5000).nullable().optional(),
    imageAssetId: assetId,
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  }) }),
  adminController.updateArtist,
);

adminRouter.post(
  "/admin/albums",
  validate({ body: z.object({
    title: z.string().min(1).max(300),
    artistIds: z.array(objectId).min(1),
    categoryIds: z.array(objectId).optional(),
    description: z.string().max(5000).nullable().optional(),
    coverAssetId: assetId,
    status: z.enum(["DRAFT", "PUBLISHED", "UNPUBLISHED"]).optional(),
    publishedAt: z.coerce.date().nullable().optional(),
  }) }),
  adminController.createAlbum,
);
adminRouter.patch(
  "/admin/albums/:id",
  validate({ body: z.object({
    title: z.string().min(1).max(300).optional(),
    artistIds: z.array(objectId).min(1).optional(),
    categoryIds: z.array(objectId).optional(),
    description: z.string().max(5000).nullable().optional(),
    coverAssetId: assetId,
    status: z.enum(["DRAFT", "PUBLISHED", "UNPUBLISHED"]).optional(),
    publishedAt: z.coerce.date().nullable().optional(),
  }) }),
  adminController.updateAlbum,
);

adminRouter.post(
  "/admin/categories",
  validate({ body: z.object({
    name: z.string().min(1).max(200),
    slug: z.string().min(1).max(220),
    description: z.string().max(5000).nullable().optional(),
    imageAssetId: assetId,
    position: z.number().int().min(0).optional(),
    group: z.enum(["DEVOTION", "MOMENT", "GENERAL"]).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  }) }),
  adminController.createCategory,
);
adminRouter.patch(
  "/admin/categories/:id",
  validate({ body: z.object({
    name: z.string().min(1).max(200).optional(),
    slug: z.string().min(1).max(220).optional(),
    description: z.string().max(5000).nullable().optional(),
    imageAssetId: assetId,
    position: z.number().int().min(0).optional(),
    group: z.enum(["DEVOTION", "MOMENT", "GENERAL"]).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  }) }),
  adminController.updateCategory,
);

adminRouter.post(
  "/admin/tracks",
  validate({ body: z.object({
    title: z.string().min(1).max(300),
    artistIds: z.array(objectId).min(1),
    albumId: objectId.nullable().optional(),
    categoryIds: z.array(objectId).optional(),
    mediaAssetId: objectId,
    coverAssetId: assetId,
    thumbnailAssetId: assetId,
    isFeatured: z.boolean().optional(),
    isTrending: z.boolean().optional(),
    isRecommended: z.boolean().optional(),
  }) }),
  adminController.createTrack,
);
adminRouter.patch(
  "/admin/tracks/:id",
  validate({ body: z.object({
    title: z.string().min(1).max(300).optional(),
    artistIds: z.array(objectId).min(1).optional(),
    albumId: objectId.nullable().optional(),
    categoryIds: z.array(objectId).optional(),
    mediaAssetId: objectId.optional(),
    coverAssetId: assetId,
    thumbnailAssetId: assetId,
    isFeatured: z.boolean().optional(),
    isTrending: z.boolean().optional(),
    isRecommended: z.boolean().optional(),
  }) }),
  adminController.updateTrack,
);
adminRouter.post("/admin/tracks/:id/publish", adminController.publishTrack);
adminRouter.post("/admin/tracks/:id/unpublish", adminController.unpublishTrack);
adminRouter.patch(
  "/admin/tracks/:id/flags",
  validate({ body: z.object({ isFeatured: z.boolean(), isTrending: z.boolean(), isRecommended: z.boolean() }) }),
  adminController.setTrackFlags,
);

adminRouter.get("/admin/home/sections", adminController.listHomeSections);
adminRouter.post(
  "/admin/home/sections",
  validate({ body: z.object({
    key: z.string().min(1).max(100),
    title: z.string().min(1).max(200),
    subtitle: z.string().max(500).nullable().optional(),
    layout: z.enum(["GRID_2", "HORIZONTAL", "GRID_2_LARGE", "BANNER", "LIST"]).optional(),
    position: z.number().int().min(0).optional(),
    enabled: z.boolean().optional(),
    items: z.array(homeItem).default([]),
  }) }),
  adminController.createHomeSection,
);
adminRouter.patch(
  "/admin/home/sections/:id",
  validate({ body: z.object({
    key: z.string().min(1).max(100).optional(),
    title: z.string().min(1).max(200).optional(),
    subtitle: z.string().max(500).nullable().optional(),
    layout: z.enum(["GRID_2", "HORIZONTAL", "GRID_2_LARGE", "BANNER", "LIST"]).optional(),
    position: z.number().int().min(0).optional(),
    enabled: z.boolean().optional(),
    items: z.array(homeItem).optional(),
  }) }),
  adminController.updateHomeSection,
);
adminRouter.delete("/admin/home/sections/:id", adminController.deleteHomeSection);

adminRouter.post("/admin/media/:id/reprocess", adminController.reprocessMedia);
adminRouter.get("/admin/jobs/:id", adminController.getJob);
