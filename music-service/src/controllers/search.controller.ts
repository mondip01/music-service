import { Request, Response } from "express";
import { asyncHandler } from "../errors/errorHandler";
import { ok } from "../utils/response";
import { searchService, SearchType } from "../services/search.service";
import { AppError } from "../errors/AppError";

export const searchController = {
  search: asyncHandler(async (req: Request, res: Response) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 1) throw AppError.badRequest("MISSING_QUERY", "q query parameter is required");
    const type = String(req.query.type ?? "ALL").toUpperCase() as SearchType;
    if (!["ALL", "TRACK", "ALBUM", "ARTIST", "CATEGORY", "PLAYLIST"].includes(type)) {
      throw AppError.badRequest("INVALID_SEARCH_TYPE", "type must be ALL, TRACK, ALBUM, ARTIST, CATEGORY, or PLAYLIST");
    }
    const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 50);
    const cursor = req.query.cursor as string | undefined;
    ok(req, res, await searchService.search(q, type, limit, cursor));
  }),
};
