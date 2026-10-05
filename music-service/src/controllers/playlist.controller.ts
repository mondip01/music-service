import { Request, Response } from "express";
import { asyncHandler } from "../errors/errorHandler";
import { ok } from "../utils/response";
import { playlistRepository } from "../repository/playlist.repository";
import { withIdempotency } from "../middlewares/idempotency";
import { mediaService } from "../services/media.service";
import { hydrateOwnedPlaylistById } from "../services/catalogView.service";

export const playlistController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const { name, description, coverAssetId } = req.body;
    const playlist = await playlistRepository.create(req.user!.userId, name, description, coverAssetId ?? null);
    if (coverAssetId) await mediaService.attachAssetToOwner(coverAssetId, "PLAYLIST", String(playlist._id), "IMAGE");
    ok(req, res, await hydrateOwnedPlaylistById(String(playlist._id), req.user!.userId), 201);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const playlists = await playlistRepository.findByUser(req.user!.userId);
    const items = [];
    for (const playlist of playlists) items.push(await hydrateOwnedPlaylistById(String(playlist._id), req.user!.userId));
    ok(req, res, items);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await hydrateOwnedPlaylistById(req.params.id, req.user!.userId));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const { coverAssetId, ...patch } = req.body;
    await playlistRepository.update(req.params.id, req.user!.userId, { ...patch, ...(coverAssetId !== undefined ? { coverAssetId } : {}) });
    if (coverAssetId) await mediaService.attachAssetToOwner(coverAssetId, "PLAYLIST", req.params.id, "IMAGE");
    ok(req, res, await hydrateOwnedPlaylistById(req.params.id, req.user!.userId));
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await playlistRepository.remove(req.params.id, req.user!.userId);
    ok(req, res, { deleted: true });
  }),

  tracks: asyncHandler(async (req: Request, res: Response) => {
    const playlist = await hydrateOwnedPlaylistById(req.params.id, req.user!.userId);
    ok(req, res, playlist.tracks);
  }),

  addTracks: asyncHandler(async (req: Request, res: Response) => {
    const playlist = await withIdempotency("playlist-add-tracks", req.user!.userId, req, () =>
      playlistRepository.addTracks(req.params.id, req.user!.userId, req.body.trackIds),
    );
    ok(req, res, await hydrateOwnedPlaylistById(String(playlist._id), req.user!.userId));
  }),

  removeTrack: asyncHandler(async (req: Request, res: Response) => {
    await playlistRepository.removeTrack(req.params.id, req.user!.userId, req.params.trackId);
    ok(req, res, await hydrateOwnedPlaylistById(req.params.id, req.user!.userId));
  }),

  reorder: asyncHandler(async (req: Request, res: Response) => {
    const { version, orderedTrackIds } = req.body;
    await playlistRepository.reorder(req.params.id, req.user!.userId, version, orderedTrackIds);
    ok(req, res, await hydrateOwnedPlaylistById(req.params.id, req.user!.userId));
  }),
};
