import { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../errors/errorHandler";
import { ok } from "../utils/response";
import { AppError } from "../errors/AppError";
import { Artist } from "../models/artist.models";
import { Album } from "../models/album.models";
import { Category } from "../models/category.models";
import { Track } from "../models/track.models";
import { catalogService } from "../services/catalog.service";
import { transcodingRepository } from "../repository/transcoding.repository";
import { reprocessMediaAsset } from "../services/transcoding.service";
import { mediaRepository } from "../repository/media.repository";
import { mediaService } from "../services/media.service";
import { homeRepository } from "../repository/home.repository";
import { homeService } from "../services/home.service";

function optionalObjectId(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
    throw AppError.badRequest("INVALID_ASSET_ID", `${field} must be a valid asset id`);
  }
  return value;
}

async function attachIfPresent(assetId: string | null, ownerType: "ARTIST" | "ALBUM" | "TRACK" | "CATEGORY", ownerId: string, kind: "IMAGE" | "THUMBNAIL" | "AUDIO") {
  if (!assetId) return;
  await mediaService.attachAssetToOwner(assetId, ownerType, ownerId, kind);
}

export const adminController = {
  createArtist: asyncHandler(async (req: Request, res: Response) => {
    const { imageAssetId: rawImageAssetId, ...body } = req.body;
    const imageAssetId = optionalObjectId(rawImageAssetId, "imageAssetId");
    const artist = await Artist.create({ ...body, imageAssetId: null });
    await attachIfPresent(imageAssetId, "ARTIST", String(artist._id), "IMAGE");
    if (imageAssetId) artist.imageAssetId = new Types.ObjectId(imageAssetId);
    await artist.save();
    await catalogService.invalidateCatalogCaches();
    ok(req, res, artist, 201);
  }),

  updateArtist: asyncHandler(async (req: Request, res: Response) => {
    const { imageAssetId: rawImageAssetId, ...patch } = req.body;
    const imageAssetId = rawImageAssetId === undefined ? undefined : optionalObjectId(rawImageAssetId, "imageAssetId");
    const artist = await Artist.findByIdAndUpdate(req.params.id, { $set: { ...patch, ...(imageAssetId !== undefined ? { imageAssetId: imageAssetId ? new Types.ObjectId(imageAssetId) : null } : {}) } }, { new: true });
    if (!artist) throw AppError.notFound("ARTIST_NOT_FOUND", "Artist not found");
    if (imageAssetId) await attachIfPresent(imageAssetId, "ARTIST", req.params.id, "IMAGE");
    await catalogService.invalidateCatalogCaches();
    ok(req, res, artist);
  }),

  createAlbum: asyncHandler(async (req: Request, res: Response) => {
    const { coverAssetId: rawCoverAssetId, ...body } = req.body;
    const coverAssetId = optionalObjectId(rawCoverAssetId, "coverAssetId");
    const album = await Album.create({ ...body, coverAssetId: null });
    if (coverAssetId) {
      await attachIfPresent(coverAssetId, "ALBUM", String(album._id), "IMAGE");
      album.coverAssetId = new Types.ObjectId(coverAssetId);
      await album.save();
    }
    await catalogService.invalidateCatalogCaches();
    ok(req, res, album, 201);
  }),

  updateAlbum: asyncHandler(async (req: Request, res: Response) => {
    const { coverAssetId: rawCoverAssetId, ...patch } = req.body;
    const coverAssetId = rawCoverAssetId === undefined ? undefined : optionalObjectId(rawCoverAssetId, "coverAssetId");
    const album = await Album.findByIdAndUpdate(req.params.id, { $set: { ...patch, ...(coverAssetId !== undefined ? { coverAssetId: coverAssetId ? new Types.ObjectId(coverAssetId) : null } : {}) } }, { new: true });
    if (!album) throw AppError.notFound("ALBUM_NOT_FOUND", "Album not found");
    if (coverAssetId) await attachIfPresent(coverAssetId, "ALBUM", req.params.id, "IMAGE");
    await catalogService.invalidateCatalogCaches();
    ok(req, res, album);
  }),

  createCategory: asyncHandler(async (req: Request, res: Response) => {
    const { imageAssetId: rawImageAssetId, ...body } = req.body;
    const imageAssetId = optionalObjectId(rawImageAssetId, "imageAssetId");
    const category = await Category.create({ ...body, imageAssetId: null });
    if (imageAssetId) {
      await attachIfPresent(imageAssetId, "CATEGORY", String(category._id), "IMAGE");
      category.imageAssetId = new Types.ObjectId(imageAssetId);
      await category.save();
    }
    await catalogService.invalidateCatalogCaches();
    ok(req, res, category, 201);
  }),

  updateCategory: asyncHandler(async (req: Request, res: Response) => {
    const { imageAssetId: rawImageAssetId, ...patch } = req.body;
    const imageAssetId = rawImageAssetId === undefined ? undefined : optionalObjectId(rawImageAssetId, "imageAssetId");
    const category = await Category.findByIdAndUpdate(req.params.id, { $set: { ...patch, ...(imageAssetId !== undefined ? { imageAssetId: imageAssetId ? new Types.ObjectId(imageAssetId) : null } : {}) } }, { new: true });
    if (!category) throw AppError.notFound("CATEGORY_NOT_FOUND", "Category not found");
    if (imageAssetId) await attachIfPresent(imageAssetId, "CATEGORY", req.params.id, "IMAGE");
    await catalogService.invalidateCatalogCaches();
    ok(req, res, category);
  }),

  createTrack: asyncHandler(async (req: Request, res: Response) => {
    const { mediaAssetId: rawMediaAssetId, coverAssetId: rawCoverAssetId, thumbnailAssetId: rawThumbnailAssetId, durationSec: _durationSec, ...body } = req.body;
    const mediaAssetId = optionalObjectId(rawMediaAssetId, "mediaAssetId");
    if (!mediaAssetId) throw AppError.badRequest("AUDIO_ASSET_REQUIRED", "mediaAssetId is required for a track");
    const coverAssetId = optionalObjectId(rawCoverAssetId, "coverAssetId");
    const thumbnailAssetId = optionalObjectId(rawThumbnailAssetId, "thumbnailAssetId");

    const track = await Track.create({
      ...body,
      mediaAssetId: new Types.ObjectId(mediaAssetId),
      coverAssetId: null,
      thumbnailAssetId: null,
      durationSec: 0,
      status: "DRAFT",
    });

    await attachIfPresent(mediaAssetId, "TRACK", String(track._id), "AUDIO");
    if (coverAssetId) {
      await attachIfPresent(coverAssetId, "TRACK", String(track._id), "IMAGE");
      track.coverAssetId = new Types.ObjectId(coverAssetId);
    }
    if (thumbnailAssetId) {
      await attachIfPresent(thumbnailAssetId, "TRACK", String(track._id), "THUMBNAIL");
      track.thumbnailAssetId = new Types.ObjectId(thumbnailAssetId);
    }
    await track.save();
    await catalogService.invalidateCatalogCaches();
    ok(req, res, track, 201);
  }),

  updateTrack: asyncHandler(async (req: Request, res: Response) => {
    const { durationSec: _durationSec, mediaAssetId: rawMediaAssetId, coverAssetId: rawCoverAssetId, thumbnailAssetId: rawThumbnailAssetId, ...patch } = req.body;
    const mediaAssetId = rawMediaAssetId === undefined ? undefined : optionalObjectId(rawMediaAssetId, "mediaAssetId");
    const coverAssetId = rawCoverAssetId === undefined ? undefined : optionalObjectId(rawCoverAssetId, "coverAssetId");
    const thumbnailAssetId = rawThumbnailAssetId === undefined ? undefined : optionalObjectId(rawThumbnailAssetId, "thumbnailAssetId");

    const track = await Track.findById(req.params.id);
    if (!track) throw AppError.notFound("TRACK_NOT_FOUND", "Track not found");

    if (mediaAssetId) await attachIfPresent(mediaAssetId, "TRACK", req.params.id, "AUDIO");
    if (coverAssetId) await attachIfPresent(coverAssetId, "TRACK", req.params.id, "IMAGE");
    if (thumbnailAssetId) await attachIfPresent(thumbnailAssetId, "TRACK", req.params.id, "THUMBNAIL");

    Object.assign(track, patch);
    if (mediaAssetId !== undefined) track.mediaAssetId = new Types.ObjectId(mediaAssetId);
    if (coverAssetId !== undefined) track.coverAssetId = coverAssetId ? new Types.ObjectId(coverAssetId) : null;
    if (thumbnailAssetId !== undefined) track.thumbnailAssetId = thumbnailAssetId ? new Types.ObjectId(thumbnailAssetId) : null;
    await track.save();
    await catalogService.invalidateTrackCache(req.params.id);
    ok(req, res, track);
  }),

  publishTrack: asyncHandler(async (req: Request, res: Response) => {
    const track = await Track.findById(req.params.id);
    if (!track) throw AppError.notFound("TRACK_NOT_FOUND", "Track not found");
    const audioAsset = await mediaRepository.findById(String(track.mediaAssetId));
    if (!audioAsset || audioAsset.status !== "READY") {
      throw AppError.unprocessable("TRACK_NOT_READY", "Track's audio must be READY before publishing");
    }
    track.status = "PUBLISHED";
    track.publishedAt = new Date();
    await track.save();
    await catalogService.invalidateTrackCache(req.params.id);
    ok(req, res, track);
  }),

  unpublishTrack: asyncHandler(async (req: Request, res: Response) => {
    const track = await Track.findByIdAndUpdate(req.params.id, { status: "UNPUBLISHED" }, { new: true });
    if (!track) throw AppError.notFound("TRACK_NOT_FOUND", "Track not found");
    await catalogService.invalidateTrackCache(req.params.id);
    ok(req, res, track);
  }),

  setTrackFlags: asyncHandler(async (req: Request, res: Response) => {
    const { isFeatured, isTrending, isRecommended } = req.body;
    const track = await Track.findByIdAndUpdate(req.params.id, { $set: { isFeatured, isTrending, isRecommended } }, { new: true });
    if (!track) throw AppError.notFound("TRACK_NOT_FOUND", "Track not found");
    await catalogService.invalidateTrackCache(req.params.id);
    ok(req, res, track);
  }),

  listHomeSections: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await homeRepository.findAll());
  }),

  createHomeSection: asyncHandler(async (req: Request, res: Response) => {
    const section = await homeRepository.create({
      key: req.body.key,
      title: req.body.title,
      subtitle: req.body.subtitle ?? null,
      layout: req.body.layout ?? "HORIZONTAL",
      position: req.body.position ?? 0,
      enabled: req.body.enabled ?? true,
      items: homeRepository.normalizeItems(req.body.items ?? []),
    });
    await homeService.invalidate();
    ok(req, res, section, 201);
  }),

  updateHomeSection: asyncHandler(async (req: Request, res: Response) => {
    const patch: Record<string, unknown> = {};
    for (const key of ["key", "title", "subtitle", "layout", "position", "enabled"]) {
      if (req.body[key] !== undefined) patch[key] = req.body[key];
    }
    if (req.body.items !== undefined) patch.items = homeRepository.normalizeItems(req.body.items);
    const section = await homeRepository.update(req.params.id, patch);
    if (!section) throw AppError.notFound("HOME_SECTION_NOT_FOUND", "Home section not found");
    await homeService.invalidate();
    ok(req, res, section);
  }),

  deleteHomeSection: asyncHandler(async (req: Request, res: Response) => {
    const result = await homeRepository.remove(req.params.id);
    if (!result.deletedCount) throw AppError.notFound("HOME_SECTION_NOT_FOUND", "Home section not found");
    await homeService.invalidate();
    ok(req, res, { deleted: true });
  }),

  reprocessMedia: asyncHandler(async (req: Request, res: Response) => {
    const asset = await mediaRepository.findById(req.params.id);
    if (!asset || !asset.sourceKey) throw AppError.notFound("MEDIA_ASSET_NOT_FOUND", "Media asset or its source is missing");
    await reprocessMediaAsset(String(asset._id), asset.sourceKey);
    ok(req, res, { mediaAssetId: String(asset._id), status: "QUEUED" }, 202);
  }),

  getJob: asyncHandler(async (req: Request, res: Response) => {
    const job = await transcodingRepository.findById(req.params.id);
    if (!job) throw AppError.notFound("JOB_NOT_FOUND", "Media job not found");
    ok(req, res, job);
  }),
};
