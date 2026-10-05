import { Types } from "mongoose";
import { v4 as uuid } from "uuid";
import { Request } from "express";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";
import { mediaRepository } from "../repository/media.repository";
import {
  getPresignedPutUrl,
  getPresignedGetUrl,
  objectExists,
  r2Keys,
} from "../providers/storage/r2.provider";
import { publish, QUEUES } from "../messaging/queueClient";
import { withIdempotency } from "../middlewares/idempotency";
import { withLock } from "./lockService";
import { Playlist } from "../models/playlist.models";

const ALLOWED_AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
]);

const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type UploadOwnerType = "TRACK" | "ARTIST" | "ALBUM" | "CATEGORY" | "PLAYLIST";
export type UploadKind = "AUDIO" | "IMAGE" | "THUMBNAIL";

function extensionForMime(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[mimeType] ?? "bin";
}

function validateOwnerId(ownerId?: string | null): Types.ObjectId | null {
  if (!ownerId) return null;
  if (!Types.ObjectId.isValid(ownerId)) {
    throw AppError.badRequest("INVALID_OWNER_ID", "ownerId must be a valid Mongo ObjectId");
  }
  return new Types.ObjectId(ownerId);
}

export const mediaService = {
  async createUploadSession(
    ownerType: UploadOwnerType,
    ownerId: string | null | undefined,
    kind: UploadKind,
    mimeType: string,
    sizeBytes: number,
    actor?: { userId: string; role?: string },
  ) {
    const isAdmin = actor?.role === "admin" || actor?.role === "content_admin" || actor?.role === "super_admin";
    if (!isAdmin && ownerType !== "PLAYLIST") {
      throw AppError.forbidden("Only admins can upload catalog media");
    }
    if (ownerType === "PLAYLIST" && ownerId && !isAdmin) {
      const playlist = await Playlist.findOne({ _id: ownerId, userId: actor?.userId }).select({ _id: 1 }).lean();
      if (!playlist) throw AppError.forbidden("You can only upload media for your own playlist");
    }

    if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
      throw AppError.badRequest("INVALID_FILE_SIZE", "sizeBytes must be a positive integer");
    }

    if (kind === "AUDIO") {
      if (ownerType !== "TRACK") {
        throw AppError.badRequest("INVALID_MEDIA_OWNER", "AUDIO assets can only belong to TRACK");
      }
      if (!ALLOWED_AUDIO_MIME.has(mimeType)) {
        throw AppError.badRequest("UNSUPPORTED_MEDIA_TYPE", `Unsupported audio mime type: ${mimeType}`);
      }
      if (sizeBytes > env.media.maxUploadSizeBytes) {
        throw AppError.badRequest("FILE_TOO_LARGE", "Audio upload exceeds MAX_UPLOAD_SIZE_BYTES");
      }
    } else {
      if (ownerType === "TRACK" || ownerType === "ARTIST" || ownerType === "ALBUM" || ownerType === "CATEGORY" || ownerType === "PLAYLIST") {
        // allowed
      }
      if (!ALLOWED_IMAGE_MIME.has(mimeType)) {
        throw AppError.badRequest("UNSUPPORTED_MEDIA_TYPE", `Unsupported image mime type: ${mimeType}`);
      }
      if (sizeBytes > env.media.maxImageUploadSizeBytes) {
        throw AppError.badRequest("FILE_TOO_LARGE", "Image upload exceeds MAX_IMAGE_UPLOAD_SIZE_BYTES");
      }
    }

    const parsedOwnerId = validateOwnerId(ownerId);
    const assetId = new Types.ObjectId();
    const uploadId = uuid();
    const extension = extensionForMime(mimeType);
    const sourceKey =
      kind === "AUDIO"
        ? r2Keys.tempUploadSource(uploadId, extension)
        : r2Keys.publicImage(String(assetId), `original.${extension}`);

    const asset = await mediaRepository.create({
      _id: assetId,
      ownerType,
      ownerId: parsedOwnerId,
      createdBy: actor?.userId ?? "unknown",
      kind,
      visibility: kind === "AUDIO" ? "PRIVATE" : "PUBLIC",
      sourceKey,
      mimeType,
      sizeBytes,
      status: "UPLOADING",
    } as any);

    const putUrl = getPresignedPutUrl(sourceKey, mimeType, env.media.presignedUploadTtlSec);
    return {
      uploadId,
      mediaAssetId: String(asset._id),
      ownerType,
      ownerId: parsedOwnerId ? String(parsedOwnerId) : null,
      kind,
      putUrl,
      objectKey: sourceKey,
      expiresInSec: env.media.presignedUploadTtlSec,
    };
  },

  async getUploadStatus(mediaAssetId: string, actor: { userId: string; role?: string }) {
    const asset = await mediaRepository.findById(mediaAssetId);
    if (!asset) throw AppError.notFound("MEDIA_ASSET_NOT_FOUND", "Media asset not found");
    const isAdmin = actor.role === "admin" || actor.role === "content_admin" || actor.role === "super_admin";
    if (!isAdmin && asset.createdBy !== actor.userId) throw AppError.forbidden("You cannot inspect this upload");
    return asset;
  },

  async completeUpload(mediaAssetId: string, actor: { userId: string; role?: string }, req: Request) {
    return withLock(`music:lock:media-upload:${mediaAssetId}`, { ttlSeconds: 60, waitMs: 1000 }, () =>
      withIdempotency("media-upload-complete", actor.userId, req, async () => {
        const asset = await mediaRepository.findById(mediaAssetId);
        if (!asset) throw AppError.notFound("MEDIA_ASSET_NOT_FOUND", "Media asset not found");
        const isAdmin = actor.role === "admin" || actor.role === "content_admin" || actor.role === "super_admin";
        if (!isAdmin && asset.createdBy !== actor.userId) throw AppError.forbidden("You cannot complete this upload");

        if (asset.status === "READY" || asset.status === "PROCESSING" || asset.status === "VALIDATING") {
          return { mediaAssetId, kind: asset.kind, status: asset.status };
        }
        if (asset.status === "FAILED") {
          throw AppError.unprocessable("MEDIA_FAILED", "Media upload has already failed");
        }
        if (!asset.sourceKey || !(await objectExists(asset.sourceKey))) {
          await mediaRepository.markStatus(mediaAssetId, "FAILED");
          throw AppError.unprocessable("UPLOAD_OBJECT_MISSING", "Uploaded object was not found in storage");
        }

        if (asset.kind === "IMAGE" || asset.kind === "THUMBNAIL") {
          await mediaRepository.markStatus(mediaAssetId, "READY", {
            playbackKey: asset.sourceKey,
          });
          return { mediaAssetId, kind: asset.kind, status: "READY" };
        }

        await mediaRepository.markStatus(mediaAssetId, "VALIDATING");
        await publish(QUEUES.MEDIA_METADATA, {
          mediaAssetId,
          sourceKey: asset.sourceKey,
        });

        return { mediaAssetId, kind: asset.kind, status: "VALIDATING" };
      }),
    );
  },

  async attachAssetToOwner(
    mediaAssetId: string,
    ownerType: UploadOwnerType,
    ownerId: string,
    kind: UploadKind,
  ) {
    if (!Types.ObjectId.isValid(ownerId)) {
      throw AppError.badRequest("INVALID_OWNER_ID", "ownerId must be a valid Mongo ObjectId");
    }

    return withLock(`music:lock:media-attach:${mediaAssetId}`, { ttlSeconds: 30, waitMs: 1000 }, async () => {
      const asset = await mediaRepository.findById(mediaAssetId);
      if (!asset) throw AppError.notFound("MEDIA_ASSET_NOT_FOUND", "Media asset not found");
      if (asset.ownerType !== ownerType) {
        throw AppError.badRequest("MEDIA_OWNER_TYPE_MISMATCH", `Asset is owned by ${asset.ownerType}, not ${ownerType}`);
      }
      if (asset.kind !== kind) {
        throw AppError.badRequest("MEDIA_KIND_MISMATCH", `Asset kind is ${asset.kind}, not ${kind}`);
      }
      if (asset.ownerId && String(asset.ownerId) !== ownerId) {
        throw AppError.conflict("MEDIA_ASSET_ALREADY_ATTACHED", "Media asset is already attached to another resource");
      }
      if (kind !== "AUDIO" && asset.status !== "READY") {
        throw AppError.unprocessable("MEDIA_NOT_READY", "Image asset must be READY before it can be attached");
      }
      if (kind === "AUDIO" && asset.status === "FAILED") {
        throw AppError.unprocessable("MEDIA_FAILED", "Audio asset has failed processing");
      }

      await mediaRepository.attachOwner(mediaAssetId, ownerId);
      return mediaRepository.findById(mediaAssetId);
    });
  },

  async getPlaybackUrl(mediaAssetId: string): Promise<{ url: string; expiresAt: string }> {
    const asset = await mediaRepository.findById(mediaAssetId);
    if (!asset || asset.status !== "READY") {
      throw AppError.unprocessable("MEDIA_NOT_READY", "Media is not ready for playback");
    }
    const key = asset.hlsMasterKey ?? asset.playbackKey;
    if (!key) throw AppError.internal("Playable object key missing on a READY asset");

    const url = getPresignedGetUrl(key, env.media.playbackUrlTtlSec);
    const expiresAt = new Date(Date.now() + env.media.playbackUrlTtlSec * 1000).toISOString();
    return { url, expiresAt };
  },
};
