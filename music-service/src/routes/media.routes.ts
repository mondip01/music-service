import { Router } from "express";
import { mediaController } from "../controllers/media.controller";
import { requireAuth } from "../middlewares/authMiddleware";
import { rateLimit } from "../middlewares/rateLimit";
import { env } from "../config/env";
import { validate } from "../validators/validate";
import { z } from "zod";

export const mediaRouter = Router();

mediaRouter.post(
  "/media/uploads",
  requireAuth,
  rateLimit("media-upload", env.rateLimit.maxUpload, env.rateLimit.windowSec),
  validate({
    body: z.object({
      ownerType: z.enum(["TRACK", "ARTIST", "ALBUM", "CATEGORY", "PLAYLIST"]),
      ownerId: z.string().nullable().optional(),
      kind: z.enum(["AUDIO", "IMAGE", "THUMBNAIL"]),
      mimeType: z.string(),
      sizeBytes: z.number().int().positive(),
    }),
  }),
  mediaController.createUpload,
);
mediaRouter.get("/media/uploads/:id", requireAuth, mediaController.uploadStatus);
mediaRouter.post("/media/uploads/:id/complete", requireAuth, mediaController.completeUpload);
