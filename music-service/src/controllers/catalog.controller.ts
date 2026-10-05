import { Request, Response } from "express";
import { asyncHandler } from "../errors/errorHandler";
import { ok } from "../utils/response";
import { catalogService } from "../services/catalog.service";
import { cursorPaginationQuery } from "../validators/pagination";

export const catalogController = {
  listArtists: asyncHandler(async (req: Request, res: Response) => {
    const { limit, cursor } = cursorPaginationQuery.parse(req.query);
    ok(req, res, await catalogService.listArtists(limit, cursor));
  }),

  getArtist: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await catalogService.getArtist(req.params.id));
  }),

  listAlbums: asyncHandler(async (req: Request, res: Response) => {
    const { limit, cursor } = cursorPaginationQuery.parse(req.query);
    ok(req, res, await catalogService.listAlbums(limit, cursor));
  }),

  getAlbum: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await catalogService.getAlbumWithTracks(req.params.id));
  }),

  getTrack: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await catalogService.getTrack(req.params.id));
  }),

  listCategories: asyncHandler(async (req: Request, res: Response) => {
    ok(req, res, await catalogService.listCategories());
  }),

  getCategoryTracks: asyncHandler(async (req: Request, res: Response) => {
    const { limit, cursor } = cursorPaginationQuery.parse(req.query);
    ok(req, res, await catalogService.getCategoryTracks(req.params.id, limit, cursor));
  }),
};
