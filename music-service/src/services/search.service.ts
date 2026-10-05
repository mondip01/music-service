import crypto from "node:crypto";
import { Artist } from "../models/artist.models";
import { Album } from "../models/album.models";
import { Category } from "../models/category.models";
import { Track } from "../models/track.models";
import { Playlist } from "../models/playlist.models";
import { cacheService } from "./cacheService";
import { hydrateAlbums, hydrateArtists, hydrateCategories, hydratePlaylistById, hydrateTracks } from "./catalogView.service";

export type SearchType = "TRACK" | "ALBUM" | "ARTIST" | "CATEGORY" | "PLAYLIST" | "ALL";

function hashQuery(q: string, type: string, cursor?: string): string {
  return crypto.createHash("sha1").update(`${q}::${type}::${cursor ?? ""}`).digest("hex");
}

export const searchService = {
  async search(q: string, type: SearchType, limit: number, cursor?: string) {
    const cacheKey = `music:search:${hashQuery(q, type, cursor)}`;
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const should = (value: SearchType) => type === "ALL" || type === value;

    const [trackRows, albumRows, artistRows, categoryRows, playlistRows] = await Promise.all([
      should("TRACK") ? Track.find({ title: regex, status: "PUBLISHED" }).limit(limit).lean() : [],
      should("ALBUM") ? Album.find({ title: regex, status: "PUBLISHED" }).limit(limit).lean() : [],
      should("ARTIST") ? Artist.find({ name: regex, status: "ACTIVE" }).limit(limit).lean() : [],
      should("CATEGORY") ? Category.find({ name: regex, status: "ACTIVE" }).limit(limit).lean() : [],
      should("PLAYLIST") ? Playlist.find({ name: regex, visibility: "PUBLIC" }).limit(limit).lean() : [],
    ]);

    const [tracks, albums, artists, categories] = await Promise.all([
      hydrateTracks(trackRows),
      hydrateAlbums(albumRows, false),
      hydrateArtists(artistRows),
      hydrateCategories(categoryRows, false),
    ]);

    const playlists = [];
    for (const row of playlistRows as any[]) {
      playlists.push(await hydratePlaylistById(String(row._id)));
    }

    const items = [
      ...tracks,
      ...albums,
      ...artists,
      ...categories,
      ...playlists,
    ].slice(0, Math.max(limit, 1));

    const result = {
      query: q,
      type,
      items,
      tracks,
      albums,
      artists,
      categories,
      playlists,
      nextCursor: null,
    };

    await cacheService.set(cacheKey, result, 60);
    return result;
  },
};
