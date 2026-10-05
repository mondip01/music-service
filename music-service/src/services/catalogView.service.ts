import { Types } from "mongoose";
import { Artist } from "../models/artist.models";
import { Album } from "../models/album.models";
import { Category } from "../models/category.models";
import { Track } from "../models/track.models";
import { Playlist } from "../models/playlist.models";
import { PlaylistTrack } from "../models/playlist-item.models";
import { MediaAsset } from "../models/media-asset.models";
import { getPublicOrSignedUrl } from "../providers/storage/r2.provider";
import { env } from "../config/env";
import { AppError } from "../errors/AppError";

function uniqueIds(values: Array<unknown>): string[] {
  return [...new Set(values.filter(Boolean).map(String))];
}

function toObjectIds(ids: string[]): Types.ObjectId[] {
  return ids.filter(Types.ObjectId.isValid).map((id) => new Types.ObjectId(id));
}

function mediaView(asset: any, includeUrl = true) {
  if (!asset) return null;
  const key = asset.playbackKey ?? asset.sourceKey;
  return {
    assetId: String(asset._id),
    kind: asset.kind,
    mimeType: asset.mimeType,
    status: asset.status,
    url: includeUrl && asset.status === "READY" && key
      ? getPublicOrSignedUrl(key, env.media.imageUrlTtlSec)
      : null,
  };
}

async function loadMedia(ids: string[]) {
  if (ids.length === 0) return new Map<string, any>();
  const rows = await MediaAsset.find({ _id: { $in: toObjectIds(ids) } }).lean();
  return new Map(rows.map((row) => [String(row._id), row]));
}

export async function hydrateTracks(rows: any[]) {
  if (rows.length === 0) return [];

  const artistIds = uniqueIds(rows.flatMap((row) => row.artistIds ?? []));
  const albumIds = uniqueIds(rows.map((row) => row.albumId));
  const categoryIds = uniqueIds(rows.flatMap((row) => row.categoryIds ?? []));
  const mediaIds = uniqueIds([
    ...rows.map((row) => row.mediaAssetId),
    ...rows.map((row) => row.coverAssetId),
    ...rows.map((row) => row.thumbnailAssetId),
  ]);

  const [artists, albums, categories, media] = await Promise.all([
    Artist.find({ _id: { $in: toObjectIds(artistIds) }, status: "ACTIVE" }).lean(),
    Album.find({ _id: { $in: toObjectIds(albumIds) } }).lean(),
    Category.find({ _id: { $in: toObjectIds(categoryIds) } }).lean(),
    loadMedia(mediaIds),
  ]);

  const extraArtistIds = uniqueIds((albums as any[]).flatMap((album) => album.artistIds ?? []));
  const extraArtists = extraArtistIds.length > 0
    ? await Artist.find({ _id: { $in: toObjectIds(extraArtistIds) }, status: "ACTIVE" }).lean()
    : [];
  const allArtists = [...artists, ...extraArtists];
  const artistMap = new Map(allArtists.map((row) => [String(row._id), row]));
  const albumMap = new Map(albums.map((row) => [String(row._id), row]));
  const categoryMap = new Map(categories.map((row) => [String(row._id), row]));

  const artistImageIds = uniqueIds(allArtists.map((row) => row.imageAssetId));
  const albumCoverIds = uniqueIds(albums.map((row) => row.coverAssetId));
  const categoryImageIds = uniqueIds(categories.map((row) => row.imageAssetId));
  const extraMedia = await loadMedia([...artistImageIds, ...albumCoverIds, ...categoryImageIds]);
  for (const [key, value] of extraMedia) media.set(key, value);

  return rows.map((row) => {
    const album = row.albumId ? albumMap.get(String(row.albumId)) : null;
    const artistsView = (row.artistIds ?? [])
      .map((id: unknown) => artistMap.get(String(id)))
      .filter(Boolean)
      .map((artist: any) => ({
        id: String(artist._id),
        name: artist.name,
        slug: artist.slug,
        image: mediaView(media.get(String(artist.imageAssetId))),
      }));

    const categoriesView = (row.categoryIds ?? [])
      .map((id: unknown) => categoryMap.get(String(id)))
      .filter(Boolean)
      .map((category: any) => ({
        id: String(category._id),
        name: category.name,
        slug: category.slug,
        image: mediaView(media.get(String(category.imageAssetId))),
      }));

    const albumView = album
      ? {
          id: String(album._id),
          title: album.title,
          description: album.description,
          artists: (album.artistIds ?? [])
            .map((id: unknown) => artistMap.get(String(id)))
            .filter(Boolean)
            .map((artist: any) => ({
              id: String(artist._id),
              name: artist.name,
              slug: artist.slug,
              image: mediaView(media.get(String(artist.imageAssetId))),
            })),
          cover: mediaView(media.get(String(album.coverAssetId))),
        }
      : null;

    const cover = mediaView(
      media.get(String(row.coverAssetId)) ?? media.get(String(album?.coverAssetId)),
    );
    const thumbnail = mediaView(media.get(String(row.thumbnailAssetId)));
    const audio = mediaView(media.get(String(row.mediaAssetId)), false);

    return {
      type: "TRACK" as const,
      id: String(row._id),
      name: row.title,
      title: row.title,
      slug: row.slug ?? null,
      durationSec: row.durationSec,
      status: row.status,
      playCount: row.playCount,
      isFeatured: row.isFeatured,
      isTrending: row.isTrending,
      isRecommended: row.isRecommended,
      artists: artistsView,
      album: albumView,
      categories: categoriesView,
      image: cover ?? thumbnail,
      cover,
      thumbnail,
      audio,
    };
  });
}

export async function hydrateAlbums(rows: any[], includeTracks = true) {
  if (rows.length === 0) return [];
  const artistIds = uniqueIds(rows.flatMap((row) => row.artistIds ?? []));
  const categoryIds = uniqueIds(rows.flatMap((row) => row.categoryIds ?? []));
  const coverIds = uniqueIds(rows.map((row) => row.coverAssetId));

  const trackRows = includeTracks
    ? await Track.find({ albumId: { $in: rows.map((row) => row._id) }, status: "PUBLISHED" }).sort({ position: 1 }).lean()
    : [];
  const trackArtistIds = uniqueIds((trackRows as any[]).flatMap((row) => row.artistIds ?? []));
  const allArtistIds = uniqueIds([...artistIds, ...trackArtistIds]);

  const [artists, categories, media, hydratedTrackRows] = await Promise.all([
    Artist.find({ _id: { $in: toObjectIds(allArtistIds) }, status: "ACTIVE" }).lean(),
    Category.find({ _id: { $in: toObjectIds(categoryIds) } }).lean(),
    loadMedia(coverIds),
    includeTracks ? hydrateTracks(trackRows as any[]) : Promise.resolve([]),
  ]);

  const artistMap = new Map(artists.map((row) => [String(row._id), row]));
  const categoryMap = new Map(categories.map((row) => [String(row._id), row]));
  const artistImageMedia = await loadMedia(uniqueIds(artists.map((row) => row.imageAssetId)));
  for (const [key, value] of artistImageMedia) media.set(key, value);
  const categoryImageMedia = await loadMedia(uniqueIds(categories.map((row) => row.imageAssetId)));
  for (const [key, value] of categoryImageMedia) media.set(key, value);

  // Build a raw-track lookup as the hydrated track's album summary is not the
  // canonical grouping key.
  const hydratedById = new Map((hydratedTrackRows as any[]).map((track) => [String(track.id), track]));
  const tracksByAlbum = new Map<string, any[]>();
  for (const rawTrack of trackRows as any[]) {
    const list = tracksByAlbum.get(String(rawTrack.albumId)) ?? [];
    const hydrated = hydratedById.get(String(rawTrack._id));
    if (hydrated) list.push(hydrated);
    tracksByAlbum.set(String(rawTrack.albumId), list);
  }

  return rows.map((row) => ({
    type: "ALBUM" as const,
    id: String(row._id),
    name: row.title,
    title: row.title,
    description: row.description,
    status: row.status,
    publishedAt: row.publishedAt,
    artists: (row.artistIds ?? [])
      .map((id: unknown) => artistMap.get(String(id)))
      .filter(Boolean)
      .map((artist: any) => ({
        id: String(artist._id),
        name: artist.name,
        slug: artist.slug,
        image: mediaView(artistImageMedia.get(String(artist.imageAssetId))),
      })),
    categories: (row.categoryIds ?? [])
      .map((id: unknown) => categoryMap.get(String(id)))
      .filter(Boolean)
      .map((category: any) => ({
        id: String(category._id),
        name: category.name,
        slug: category.slug,
        image: mediaView(categoryImageMedia.get(String(category.imageAssetId))),
      })),
    image: mediaView(media.get(String(row.coverAssetId))),
    cover: mediaView(media.get(String(row.coverAssetId))),
    tracks: includeTracks ? (tracksByAlbum.get(String(row._id)) ?? []) : [],
  }));
}

export async function hydrateArtists(rows: any[]) {
  if (rows.length === 0) return [];
  const imageMedia = await loadMedia(uniqueIds(rows.map((row) => row.imageAssetId)));
  return rows.map((row) => ({
    type: "ARTIST" as const,
    id: String(row._id),
    name: row.name,
    slug: row.slug,
    bio: row.bio,
    status: row.status,
    image: mediaView(imageMedia.get(String(row.imageAssetId))),
  }));
}

export async function hydrateCategories(rows: any[], includeTracks = false) {
  if (rows.length === 0) return [];
  const imageMedia = await loadMedia(uniqueIds(rows.map((row) => row.imageAssetId)));
  const trackRows = includeTracks
    ? await Track.find({ categoryIds: { $in: rows.map((row) => row._id) }, status: "PUBLISHED" }).sort({ position: 1 }).lean()
    : [];
  const trackMap = new Map<string, any[]>();
  for (const track of trackRows as any[]) {
    for (const categoryId of track.categoryIds ?? []) {
      const key = String(categoryId);
      const list = trackMap.get(key) ?? [];
      list.push(track);
      trackMap.set(key, list);
    }
  }

  const result = [];
  for (const row of rows) {
    result.push({
      type: "CATEGORY" as const,
      id: String(row._id),
      name: row.name,
      slug: row.slug,
      description: row.description,
      position: row.position,
      group: row.group ?? "GENERAL",
      status: row.status,
      image: mediaView(imageMedia.get(String(row.imageAssetId))),
      tracks: includeTracks ? await hydrateTracks(trackMap.get(String(row._id)) ?? []) : undefined,
    });
  }
  return result;
}

async function hydratePlaylist(playlistId: string, userId?: string) {
  const query: any = { _id: playlistId };
  if (userId) query.userId = userId;
  else query.visibility = "PUBLIC";
  const playlist = await Playlist.findOne(query).lean();
  if (!playlist) throw AppError.notFound("PLAYLIST_NOT_FOUND", "Playlist not found");

  const rows = await PlaylistTrack.find({ playlistId: playlist._id }).sort({ position: 1 }).lean();
  const tracks = await hydrateTracks(await Track.find({ _id: { $in: rows.map((row) => row.trackId) }, status: "PUBLISHED" }).lean());
  const byId = new Map(tracks.map((track: any) => [String(track.id), track]));
  const coverMedia = await loadMedia(uniqueIds([playlist.coverAssetId]));

  return {
    type: "PLAYLIST" as const,
    id: String(playlist._id),
    name: playlist.name,
    description: playlist.description,
    visibility: playlist.visibility,
    trackCount: playlist.trackCount,
    totalDurationSec: playlist.totalDurationSec,
    image: mediaView(coverMedia.get(String(playlist.coverAssetId))),
    cover: mediaView(coverMedia.get(String(playlist.coverAssetId))),
    tracks: rows.map((row) => ({ ...byId.get(String(row.trackId)), position: row.position, addedAt: row.addedAt })).filter((row) => row.id),
  };
}

export async function hydratePlaylistById(playlistId: string) {
  return hydratePlaylist(playlistId);
}

export async function hydrateOwnedPlaylistById(playlistId: string, userId: string) {
  return hydratePlaylist(playlistId, userId);
}

export async function hydrateContent(type: string, id: string) {
  switch (type) {
    case "TRACK": {
      const row = await Track.findOne({ _id: id, status: "PUBLISHED" }).lean();
      if (!row) throw AppError.notFound("TRACK_NOT_FOUND", "Track not found");
      return (await hydrateTracks([row]))[0];
    }
    case "ALBUM": {
      const row = await Album.findOne({ _id: id, status: "PUBLISHED" }).lean();
      if (!row) throw AppError.notFound("ALBUM_NOT_FOUND", "Album not found");
      return (await hydrateAlbums([row], true))[0];
    }
    case "ARTIST": {
      const row = await Artist.findOne({ _id: id, status: "ACTIVE" }).lean();
      if (!row) throw AppError.notFound("ARTIST_NOT_FOUND", "Artist not found");
      return (await hydrateArtists([row]))[0];
    }
    case "CATEGORY": {
      const row = await Category.findOne({ _id: id, status: "ACTIVE" }).lean();
      if (!row) throw AppError.notFound("CATEGORY_NOT_FOUND", "Category not found");
      return (await hydrateCategories([row], false))[0];
    }
    case "PLAYLIST":
      return hydratePlaylistById(id);
    default:
      throw AppError.badRequest("INVALID_CONTENT_TYPE", `Unsupported content type: ${type}`);
  }
}
