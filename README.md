# Lazidrome

**Lazidrome** is a self-hosted music library: put audio files on a server (or NAS path), and browse, search, and play them in the browser—with playlists, tags, charts, and optional YouTube / local file import.

| | |
|---|---|
| **Version** | 0.8.0-alpha.6 |
| **Stack** | Vue 3 + Vite (web app) · Fastify + SQLite (API & streaming) |
| **Languages** | English · Korean (UI) |

[한국어 README](./README.ko.md)

---

## Features

- **Library** — tracks, albums, artists; folder watcher keeps the database in sync
- **Playback** — browser player; mobile queue can use HLS for smoother background play
- **Playlists & tags** — organize and filter your collection
- **Charts & history** — listening stats over time
- **Import** — upload local audio, or pull from YouTube (needs `yt-dlp` + `ffmpeg`)
- **Files browser** — inspect the music folder on disk
- **Metadata** — edit tags; optional Last.fm enrichment
- **PWA** — installable web app
- **Auth** — password login (JWT); signed URLs for streams and cover art

---

## Requirements

- **Node.js** 20+ (20.19+ recommended for current tooling)
- Disk space for your music library
- Optional: **ffmpeg** (tag embedding / YouTube import), **yt-dlp** (YouTube import)
- Optional: [Last.fm API key](https://www.last.fm/api) for external metadata search

---

## Quick start

```bash
git clone https://github.com/dayliver/lazidrome.git
cd lazidrome
npm install

cp backend/.env.example backend/.env
# Edit backend/.env — set ADMIN_PASSWORD and JWT_SECRET (16+ characters)

# Put audio under the tracks path (default: backend/storage/tracks)
# or set TRACKS_PATH in backend/.env

npm run dev
```

| Service | URL |
|---------|-----|
| Web UI | http://localhost:3000 |
| API | http://localhost:5294 |

Open the UI, sign in with `ADMIN_PASSWORD`, and wait for the scanner to pick up files.

---

## Project layout

```
lazidrome/
├── frontend/     # Vue web app (PWA)
├── backend/      # Fastify API, SQLite, file scanner, streaming
├── docs/         # Extra guides (deploy, smoke tests, roadmap)
└── package.json  # Workspace scripts (dev, build, …)
```

- Frontend details: [frontend/README.md](./frontend/README.md)
- Backend details: [backend/README.md](./backend/README.md)

---

## Configuration (overview)

Copy `backend/.env.example` → `backend/.env`. Important variables:

| Variable | Purpose |
|----------|---------|
| `ADMIN_PASSWORD` | Login password |
| `JWT_SECRET` | JWT signing key (required in production; 16+ chars) |
| `PORT` | API port (default `5294`) |
| `TRACKS_PATH` | Root folder of your music files |
| `IMAGES_PATH` | Cover art and other images |
| `CORS_ORIGINS` | Allowed web origins (comma-separated) |
| `LASTFM_API_KEY` | Optional Last.fm features |

Folders named `_excluded` anywhere under `TRACKS_PATH` are ignored by the scanner.

---

## Scripts (repo root)

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + UI together |
| `npm run build` | Write build info and build the frontend |
| `npm run install-all` | Install workspace dependencies |
| `npm test` | Run the backend test suite (`node --test`, no extra dependencies) |

Production deploy helpers live under `scripts/` and are documented in [docs/DEPLOY.md](./docs/DEPLOY.md) (operator-oriented).

---

## Supported audio (typical)

Common formats include **MP3, FLAC, M4A/AAC, OGG/Opus, WAV**, and related types accepted by upload/scan. Exact allowlists are shared in the backend; see [backend/README.md](./backend/README.md).

---

## License

See package metadata (`ISC` in the backend package). Adjust as needed for your fork.

---

## Links

- [Korean README](./README.ko.md)
- [Frontend](./frontend/README.md) · [Frontend (한국어)](./frontend/README.ko.md)
- [Backend](./backend/README.md) · [Backend (한국어)](./backend/README.ko.md)
- [Roadmap](./docs/ROADMAP.md)
