# Music Service — Phase 1

A single Node.js/TypeScript music microservice covering the Phase 1 scope:
**catalog, media upload/transcoding, playback, queue, library, playlist,
search, analytics, admin, and sharing**.

Phase 2 features **lyrics, subscriptions, user downloads, and podcasts** have been removed from this version so they can be introduced later without mixing their business rules into the Phase 1 code.

## Project layout

```text
src/
  app.ts
  config/             environment configuration
  constants/          shared constants
  controllers/        HTTP controllers
  cron/               scheduled-job entry point
  errors/             application errors and centralized error handling
  infra/              Mongo, Redis, HTTP client, circuit breaker
  lifecycle/          graceful shutdown
  messaging/          RabbitMQ producer/consumer helpers
  middlewares/        auth, RBAC, validation, rate limiting, idempotency
  models/             one Mongoose model per file
  repository/         Mongo/data-access repositories
  providers/storage/  Cloudflare R2 storage provider
  routes/             Express route registration
  scripts/            local utility scripts
  serializers/        response/value serializers
  services/           business logic only
  testing/            test-only configuration
  types/              Express/type declarations
  utils/              cache, logging, pagination, response helpers
  validators/         Zod and pagination validators
  workers/             media metadata, transcoding, analytics workers
  worker.ts           worker process entry point
```

## Phase 1 boundaries

- **Catalog:** artists, albums, categories and tracks.
- **Media:** direct-to-R2 uploads, upload completion, metadata extraction and
  HLS transcoding.
- **Playback:** signed playback URLs, resume position, sessions and queue.
- **Library:** likes, listening history and playlists.
- **Search:** tracks, albums and artists.
- **Analytics:** asynchronous playback events.
- **Admin:** catalog management, publishing, media reprocessing and jobs.
- **Share:** public share links for supported catalog resources.

## Deferred to Phase 2

- Lyrics
- Subscriptions / premium entitlement
- User downloads
- Podcasts / podcast episodes


## Running

```bash
cp .env.example .env
npm install
npm run dev
npm run worker:dev
```

The transcoding worker requires `ffmpeg` and `ffprobe` on PATH.

## API

All application routes are mounted below `/api`. Health endpoints are
available at `/health/live` and `/health/ready`.

## Media / R2 flow

The API never receives large audio/image bytes. It creates a `MediaAsset`, returns a
short-lived R2 presigned PUT URL, and the client uploads directly to Cloudflare R2.

### Artist image

1. `POST /api/media/uploads`

```json
{
  "ownerType": "ARTIST",
  "ownerId": null,
  "kind": "IMAGE",
  "mimeType": "image/jpeg",
  "sizeBytes": 250000
}
```

The response contains `data.mediaAssetId` and `data.putUrl`.
2. Frontend/Postman sends the image bytes with `PUT data.putUrl`.
3. `POST /api/media/uploads/{mediaAssetId}/complete` verifies the R2 object and marks the image `READY`.
4. Create the artist with:

```json
{
  "name": "Anup Jalota",
  "slug": "anup-jalota",
  "imageAssetId": "<mediaAssetId>",
  "status": "ACTIVE"
}
```

The service attaches the asset to the new artist. The same pattern is used for album covers,
track covers, track thumbnails, and playlist covers.

### Track audio

Use `ownerType=TRACK`, `kind=AUDIO`, and `ownerId=null` when preparing the asset before the
track exists. After the direct R2 upload and `/complete`, the RabbitMQ media metadata and
transcoding workers run. The admin then creates the track with `mediaAssetId`. The audio asset
is attached to the track and the worker marks the track `READY` when transcoding succeeds.

## Home feed contract

`GET /api/home` is the single mobile home-feed endpoint. Admins configure sections at
`/api/admin/home/sections`. Every home item contains a discriminator so the frontend never
has to guess what an ID represents:

```json
{
  "type": "TRACK | ALBUM | PLAYLIST | CATEGORY | ARTIST",
  "id": "...",
  "name": "...",
  "image": { "assetId": "...", "url": "..." },
  "data": {}
}
```

`data` is the fully hydrated object. Track data includes artist/category/album details plus
cover, thumbnail and audio asset metadata. Album and playlist data include their ordered tracks.
Category and artist data include their display image. This is what lets the frontend render the
name/image immediately without making an extra lookup just to resolve an ID.

The default sections map to the supplied UI concepts:

- `todays_divine_picks` — tracks and other curated content in a 2-column grid.
- `explore_by_devotion` — category cards such as Krishna/Shiva devotion.
- `bhakti_for_every_moment` — categories grouped with `group=MOMENT`.
- `trending` — trending tracks.

Admins can add any number of additional sections and can mix content types in a section.

## Search contract

`GET /api/search?q=krishna&type=ALL` returns both the legacy grouped arrays and a unified
`data.items` array. Every item has `type`, `id`, `name`, `image`, and hydrated details. Supported
types are `TRACK`, `ALBUM`, `ARTIST`, `CATEGORY`, `PLAYLIST`, and `ALL`.
