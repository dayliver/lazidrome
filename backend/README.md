# Lazidrome — Backend

API, SQLite library database, folder scanner, and audio streaming for **Lazidrome**.

[한국어](./README.ko.md) · [Project root](../README.md) · [Frontend](../frontend/README.md)

---

## What this package does

- Fastify HTTP API under `/api`
- Watches `TRACKS_PATH` and indexes audio into SQLite
- Streams tracks (full when authenticated / signed; short preview when not)
- Serves cover images; optional Last.fm enrichment and YouTube import
- Password login → JWT; media URLs use short-lived HMAC signatures

---

## Requirements

- Node.js 20+ (20.19+ recommended)
- Write access for SQLite (`database/`) and image storage
- Optional: **ffmpeg**, **yt-dlp** for import / tag embedding

---

## Setup

```bash
cd backend
cp .env.example .env
# Set at least ADMIN_PASSWORD and JWT_SECRET (16+ characters)

npm install   # or install from the monorepo root
npm run dev   # nodemon on src/index.js
```

Default listen: **http://localhost:5294**

From the monorepo root: `npm run dev` starts backend and frontend together.

Health check: `GET /api` → `{ message, db, build }`.

---

## Environment variables

Never commit `.env`. Template: [`.env.example`](./.env.example)

| Variable | Description |
|----------|-------------|
| `ADMIN_PASSWORD` | Login password (**required**) |
| `JWT_SECRET` | JWT signing secret (**16+ chars**; required in production) |
| `PORT` | Listen port (default `5294`) |
| `TRACKS_PATH` | Music library root (default `./storage/tracks`) |
| `IMAGES_PATH` | Covers and static images (default `./storage/images`) |
| `CORS_ORIGINS` | Allowed browser origins, comma-separated |
| `MEDIA_TOKEN_TTL_SEC` | Stream/image signature TTL in seconds (default `7200`) |
| `STREAM_PREVIEW_SECONDS` | Unauthenticated stream preview length |
| `LASTFM_API_KEY` | Optional Last.fm |
| `YT_DLP_BIN` / `FFMPEG_BIN` | Optional paths for YouTube import |
| `IMPORT_TEMP_DIR` | Temp dir for imports |

Any path segment named `_excluded` under `TRACKS_PATH` is skipped by the scanner.

---

## Audio formats

Upload and scan share a common extension set, including:

`.mp3` · `.flac` · `.m4a` · `.aac` · `.ogg` · `.opus` · `.wav` · `.wma` · `.ape` · `.alac`

---

## Layout

```
backend/
├── database/          # schema.sql + SQLite DB (created at runtime)
├── src/
│   ├── index.js       # app entry
│   ├── db.js
│   ├── routes/        # HTTP routes
│   ├── handlers/
│   ├── services/      # scanner, stream, import, …
│   ├── repositories/
│   └── lib/
├── .env.example
└── package.json
```

Flow: **routes → handlers → services / repositories**.

---

## Auth (short)

| Endpoint | Notes |
|----------|--------|
| `POST /api/auth/login` | `{ "password" }` → JWT |
| Most `/api/*` | `Authorization: Bearer …` |
| `GET /api/stream/:id` | Signed or JWT → full; else preview |
| `GET /api/images/…` | Signature or JWT |
| `POST /api/auth/media-sign` | Issues `exp` / `sig` for media URLs |

---

## API overview

Handlers under `src/handlers/` are the source of truth. Common areas:

| Area | Examples |
|------|----------|
| Auth | login, media-sign |
| Library | tracks, albums, artists, tags, search |
| Stream | `GET /api/stream/:id` |
| Playlists | CRUD, ordering, smart mixes |
| Stats / history | plays, top charts, play history |
| Import | local upload staging, YouTube jobs |
| Files | browse / delete under `TRACKS_PATH` |
| Admin | orphan cleanup helpers |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development with nodemon |
| `npm run serve` | Example PM2 start script |

---

## Related docs

- [Root README](../README.md)
- [Deploy](../docs/DEPLOY.md)
- [Phase 1 smoke](../docs/PHASE1_SMOKE.md)
- [Roadmap](../docs/ROADMAP.md)
