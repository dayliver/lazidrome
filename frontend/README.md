# Lazidrome 프론트엔드

이 저장소의 **웹 UI(프론트엔드 앱)** 입니다. Node 백엔드가 제공하는 REST API와 오디오 스트림을 사용해, 서버에 둔 음원 라이브러리를 브라우저에서 탐색·재생합니다.

- 백엔드: [../backend/README.md](../backend/README.md)
- 모노레포 배포: [../docs/DEPLOY.md](../docs/DEPLOY.md)
- 보안·로드맵: [../docs/ROADMAP.md](../docs/ROADMAP.md)

---

## 기술 스택

| 구분 | 사용 |
|------|------|
| 프레임워크 | Vue 3 (`<script setup>`), Vue Router 5 |
| 상태 | Pinia |
| 빌드 | Vite 8, TypeScript (`vue-tsc`) |
| 스타일 | Tailwind CSS 4 (`@tailwindcss/vite`) |
| UI | Reka UI, class-variance-authority, Lucide 아이콘 |
| 피드백 | `vue-sonner` (`lib/notify.js` 래퍼) |
| PWA | `vite-plugin-pwa` (매니페스트 + Service Worker) |

오디오 재생은 **HTML `<audio>` 단일 엘리먼트** 기반입니다. 스트림·커버 URL에는 JWT를 쿼리에 넣지 않고, **`POST /api/auth/media-sign`** 으로 받은 단기 **`exp` / `sig`** 를 붙입니다.

---

## 사전 요구 사항

- Node.js 20+ 권장
- 로컬 개발 시 **백엔드가 `http://localhost:5294`에서 동작**해야 합니다. Vite는 `/api`를 해당 주소로 프록시합니다.

모노레포 루트에서 한 번에 띄우기:

```bash
cd ..   # lazidrome 루트
npm install
npm run dev
```

---

## 설치 및 실행

```bash
cd frontend
npm install
```

### 개발 서버

```bash
npm run dev
```

기본 주소: **http://localhost:3000**

### 프로덕션 빌드

루트에서 배포용 빌드(버전 JSON 포함):

```bash
cd ..
npm run build
```

또는 프론트만:

```bash
cd frontend
npm run build
```

출력: `frontend/dist/` (정적 파일 + `manifest.webmanifest`, `sw.js`, `workbox-*.js` 등)

`npm run build` 시 루트 `scripts/write-build-info.js`가 **`public/build-info.json`** 을 갱신합니다. Settings 화면의 **배포 · 버전** 표시에 사용됩니다.

### 빌드 결과 미리보기

```bash
npm run preview
```

API까지 확인하려면 백엔드를 함께 띄우고, 동일 오리진이 아니면 `vite.config.ts`의 `preview.proxy` 등을 맞춥니다.

---

## 환경 변수

Vite 규칙에 따라 `frontend/.env` 등에 **`VITE_` 접두사** 변수만 클라이언트에 노출됩니다. 대부분의 설정(서버 URL, 로그인)은 **Settings UI**에서 `localStorage`에 저장됩니다.

| 변수 (예) | 설명 |
|-----------|------|
| `VITE_*` | 필요 시만 정의 (기본은 Settings의 서버 URL) |

---

## 디렉터리 개요

```
frontend/
├── public/
│   ├── pwa-192.png      # PWA 아이콘 (192×192)
│   ├── pwa-512.png      # PWA 아이콘 (512×512, maskable)
│   ├── icons.svg        # favicon·보조 자산
│   └── build-info.json  # 빌드 시각 (npm run build 시 생성)
├── src/
│   ├── components/      # UI·플레이어·메타데이터 편집 등
│   ├── stores/          # auth, library, player, playlist, theme …
│   ├── router/          # 라우트, visitRecorder
│   ├── lib/             # notify, visitHistory, titleParts, image …
│   ├── composables/     # useHomePage, useRequiresAuth, useCoverUrl …
│   ├── views/
│   ├── App.vue
│   └── main.ts          # PWA registerSW
├── index.html           # lang="ko", manifest 링크는 빌드 시 주입
├── vite.config.ts       # 프록시, Tailwind, PWA manifest
└── package.json
```

| 모듈 | 역할 |
|------|------|
| [`stores/player.js`](src/stores/player.js) | 재생, 대기열, Media Session, 프리로드, 끝 구간 볼륨 페이드 |
| [`stores/auth.js`](src/stores/auth.js) | 로그인 JWT, `media-sign`, `fetchWithAuth`, 커버 URL |
| [`lib/visitHistory.ts`](src/lib/visitHistory.ts) | 홈 **자주 찾은 항목** (최근 7일, 플레이리스트·앨범·아티스트·태그만) |
| [`router/visitRecorder.ts`](src/router/visitRecorder.ts) | 상세 페이지 방문 기록 |

---

## API와 인증 (요약)

- **일반 API**: `Authorization: Bearer <JWT>` (`auth.fetchWithAuth`).
- **스트림·이미지**: `auth.ensureStreamSignature(trackId)` → 쿼리 `exp` & `sig` (기본 TTL 2시간, `MEDIA_TOKEN_TTL_SEC`).
- **개발**: Vite가 `/api`를 `localhost:5294`로 프록시하므로 상대 경로 `/api/...` 사용 가능.
- **헬스**: `GET /api` — 로그인 없이 백엔드 `build` 정보 확인 (Settings 배포 버전).

---

## PWA (Progressive Web App)

### 동작 요약

- [`vite.config.ts`](vite.config.ts)의 **`vite-plugin-pwa`** 가 빌드 시 **웹 앱 매니페스트**와 **Service Worker**를 생성합니다.
- [`main.ts`](src/main.ts)에서 `registerSW({ immediate: true })` — 새 빌드 배포 시 **자동 갱신**(`registerType: 'autoUpdate'`).
- Workbox는 **JS/CSS/HTML/PNG 등 빌드 산출물**만 프리캐시합니다. **`/api`는 SW가 가로채지 않음** (`navigateFallbackDenylist: [/^\/api/]`).
- **설치(홈 화면에 추가)** 는 보통 **HTTPS**에서 동작합니다. `localhost`는 예외로 허용되는 경우가 많습니다.

### 아이콘·매니페스트 설정 (필수 체크리스트)

PWA 아이콘은 **소스 PNG 파일을 교체**하고, manifest는 **Vite 설정**에서 참조합니다. 별도 `manifest.json`을 손으로 두지 않아도 됩니다.

| 항목 | 위치 | 설명 |
|------|------|------|
| **192×192 아이콘** | [`public/pwa-192.png`](public/pwa-192.png) | 런처·탭 등 |
| **512×512 아이콘** | [`public/pwa-512.png`](public/pwa-512.png) | 스플래시·고해상도; **maskable**로 등록됨 — 로고는 캔버스 **중앙 80% 안**에 두면 Android 원형 마스크에 잘리지 않음 |
| **보조 SVG** | [`public/icons.svg`](public/icons.svg) | `includeAssets`에 포함 (favicon 등) |
| **manifest 정의** | [`vite.config.ts`](vite.config.ts) → `VitePWA({ manifest: { … icons: […] } })` | `name`, `short_name`, `theme_color`, `background_color`, `display: 'standalone'`, `start_url: '/'` |
| **빌드 산출** | `dist/manifest.webmanifest`, `dist/sw.js` | `npm run build` 후 생성 |

**아이콘 바꾸는 절차**

1. 디자인 툴에서 **정사각 PNG** 두 장(192, 512)을 만듭니다.
2. `frontend/public/pwa-192.png`, `pwa-512.png`를 **덮어씁니다**.
3. (선택) maskable 전용 512px — 여백이 넉넉한 버전을 추가하려면 `vite.config.ts`의 `icons` 배열에 `{ purpose: 'maskable' }` 항목을 하나 더 넣습니다.
4. `npm run build` 후 배포 (`npm run deploy` 등).
5. **이미 설치된 PWA**는 OS가 아이콘을 캐시합니다. 안 바뀌면 앱 삭제 후 **다시 “홈 화면에 추가”** 하거나, 브라우저 Application → Service Workers에서 unregister 후 재설치합니다.

**iOS Safari (선택)**

manifest만으로 부족할 때 `index.html` `<head>`에 예:

```html
<link rel="apple-touch-icon" href="/pwa-192.png" />
```

**테마 색**

- manifest `theme_color`: `#863bff` (`vite.config.ts`와 [`index.html`](index.html)의 `theme-color` 메타를 맞추면 좋습니다).

### PWA 문제 해결

| 증상 | 조치 |
|------|------|
| 예전 UI가 보임 | DevTools → Application → Service Workers → Unregister, 강력 새로고침 |
| API가 SW에 막힘 | `/api` denylist 유지 여부 확인, `dist/sw.js` 재빌드 |
| 아이콘만 안 바뀜 | PNG 교체 후 **재빌드·재배포**, 기기에서 PWA **재설치** |

---

## 주요 화면·동작

1. **설정** (`/settings`): 서버 URL, 로그인, Last.fm 연동 상태(서버 `.env`), 테마, **배포 · 버전**(`build-info.json` / `GET /api`).
2. **홈** (`/`): 로그인 후
   - **자주 찾은 항목** — 최근 **7일** 동안 연 플레이리스트·앨범·아티스트·태그 (곡은 상세 페이지가 없어 **기록·표시하지 않음**).
   - **최근 7일 많이 재생된 곡** — `GET /api/stats/top?range=7d&limit=20`.
3. **곡** (`/tracks`): `GET /api/tracks?limit=&offset=` 페이지네이션.
4. **통계** (`/stats`): `GET /api/stats/plays?range=`.
5. **플레이어**: 미니·전체 화면, Media Session, 모바일 프리로드·백그라운드 재생 보완.

라우트 `meta.requiresAuth`와 [`AuthEmptyState`](src/components/shared/AuthEmptyState.vue)로 비로그인 시 안내를 통일합니다.

---

## 스크립트 요약

| 명령 | 설명 |
|------|------|
| `npm run dev` | Vite (3000), `/api` → 5294 |
| `npm run build` | `vue-tsc` + 프로덕션 번들 + PWA 산출 |
| `npm run preview` | `dist` 미리보기 |

루트(모노레포): `npm run build` · `npm run deploy` — [../docs/DEPLOY.md](../docs/DEPLOY.md).

---

## 문제 해결

- **API 404 / CORS**: 개발 중에는 `npm run dev`(Vite)로 띄워 `/api` 프록시를 사용하세요. 프로덕션은 nginx가 `/api/`를 백엔드로 넘깁니다.
- **401 / 스트림 안 됨**: Settings에서 로그인 후, `media-sign` 만료 시 재생 버튼을 다시 누르거나 페이지 새로고침.
- **빌드 타입 오류**: `vue-tsc -b` 실패 시 `src/env.d.ts`에 `vite/client`·PWA 클라이언트 타입 참조 확인.
