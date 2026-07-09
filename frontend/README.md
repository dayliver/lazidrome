# Lazidrome — Frontend

Web UI for **Lazidrome**: browse your self-hosted library, play audio, manage playlists and tags, and import music.

[한국어](./README.ko.md) · [Project root](../README.md) · [Backend](../backend/README.md)

---

## What this package does

- Vue 3 single-page app (Vite + TypeScript)
- Talks to the Lazidrome API (`/api`) for library data and streaming
- Progressive Web App (installable; service worker via `vite-plugin-pwa`)
- UI in **English** and **Korean** (`vue-i18n`)

Main areas in the app: Home, Tracks, Albums, Artists, Playlists, Tags, Charts, History, Import / Upload, Files, Settings, Admin tools.

---

## Requirements

- Node.js 20+
- A running Lazidrome **backend** (default `http://localhost:5294`)

In development, Vite proxies `/api` to the backend.

---

## Setup

From the **monorepo root** (recommended):

```bash
cd ..   # lazidrome/
npm install
npm run dev
```

Or only this package (backend must already be running):

```bash
cd frontend
npm install
npm run dev
```

| | |
|---|---|
| Dev server | http://localhost:3000 |
| Production build | `npm run build` (or `npm run build` from the repo root) |
| Preview build | `npm run preview` |

Root `npm run build` also writes `build-info.json` used in Settings.

---

## Stack

| Area | Choice |
|------|--------|
| Framework | Vue 3 (`<script setup>`), Vue Router |
| State | Pinia |
| Build | Vite 8, TypeScript |
| Styling | Tailwind CSS 4 |
| Components | Reka UI, Lucide icons |
| Playback | HTML `<audio>`; mobile queue may use **hls.js** |
| Media URLs | Short-lived `exp` / `sig` from `POST /api/auth/media-sign` (not long-lived JWT in query strings) |

---

## Environment / proxy

Dev proxy targets the local API. For a custom API host in production, serve the built `dist/` behind the same origin as the API, or configure your reverse proxy so `/api` reaches the backend.

There is no separate frontend `.env` required for the default local setup.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production bundle |
| `npm run preview` | Serve the production build locally |
| `npm run icons:generate` | Regenerate PWA / app icons |

---

## Related docs

- [Root README](../README.md)
- [Backend README](../backend/README.md)
- [Mobile / HLS notes](../docs/MOBILE-BACKGROUND-PLAYBACK.md)
