import { catalogRepository } from "../repository/catalog.repository";
import { cacheService } from "./cacheService";
import { AppError } from "../errors/AppError";
import { hydrateAlbums, hydrateArtists, hydrateCategories, hydrateTracks } from "./catalogView.service";

const TTL = 300;

export const catalogService = {
  async listArtists(limit: number, cursor?: string) {
    const page = await catalogRepository.findArtists(limit, cursor);
    return { ...page, items: await hydrateArtists(page.items) };
  },

  async getArtist(id: string) {
    const key = `music:catalog:artist:${id}`;
    const cached = await cacheService.get<any>(key);
    if (cached) return cached;
    const artist = await catalogRepository.findArtistById(id);
    if (!artist) throw AppError.notFound("ARTIST_NOT_FOUND", "Artist not found");
    const result = (await hydrateArtists([artist]))[0];
    await cacheService.set(key, result, TTL);
    return result;
  },

  async listAlbums(limit: number, cursor?: string) {
    const page = await catalogRepository.findAlbums(limit, cursor);
    return { ...page, items: await hydrateAlbums(page.items, false) };
  },

  async getAlbumWithTracks(id: string) {
    const key = `music:catalog:album:${id}`;
    const cached = await cacheService.get<any>(key);
    if (cached) return cached;
    const album = await catalogRepository.findAlbumById(id);
    if (!album) throw AppError.notFound("ALBUM_NOT_FOUND", "Album not found");
    const result = (await hydrateAlbums([album], true))[0];
    await cacheService.set(key, result, TTL);
    return result;
  },

  async getTrack(id: string) {
    const key = `music:catalog:track:${id}`;
    const cached = await cacheService.get<any>(key);
    if (cached) return cached;
    const track = await catalogRepository.findTrackById(id);
    if (!track) throw AppError.notFound("TRACK_NOT_FOUND", "Track not found");
    const result = (await hydrateTracks([track]))[0];
    await cacheService.set(key, result, TTL);
    return result;
  },

  async listCategories() {
    const key = "music:catalog:categories";
    const cached = await cacheService.get<any[]>(key);
    if (cached) return cached;
    const rows = await catalogRepository.findCategories();
    const result = await hydrateCategories(rows, false);
    await cacheService.set(key, result, TTL);
    return result;
  },

  async getCategoryTracks(categoryId: string, limit: number, cursor?: string) {
    const page = await catalogRepository.findCategoryTracks(categoryId, limit, cursor);
    return { ...page, items: await hydrateTracks(page.items) };
  },

  async invalidateTrackCache(trackId: string) {
    await cacheService.del(`music:catalog:track:${trackId}`);
    await cacheService.delByPattern("music:home:*");
    await cacheService.delByPattern("music:search:*");
  },

  async invalidateCatalogCaches() {
    await cacheService.delByPattern("music:catalog:*");
    await cacheService.delByPattern("music:home:*");
    await cacheService.delByPattern("music:search:*");
  },
};
