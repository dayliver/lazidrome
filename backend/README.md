# Lazidrome 백엔드

SQLite 기반 음원 라이브러리 API와 스트리밍을 제공하는 **Fastify** 서버입니다. 로컬(또는 마운트) 경로의 오디오 파일을 감시해 DB에 반영하고, JWT·미디어 서명으로 API·스트림 접근을 제어합니다.

- 프론트엔드: [../frontend/README.md](../frontend/README.md) (PWA·UI 포함)
- 배포: [../docs/DEPLOY.md](../docs/DEPLOY.md)
- Phase 1 스모크: [../docs/PHASE1_SMOKE.md](../docs/PHASE1_SMOKE.md)

---

## 기술 스택

| 구분 | 사용 |
|------|------|
| 런타임 | Node.js (ESM, `"type": "module"`) |
| 웹 프레임워크 | Fastify 5 |
| DB | better-sqlite3, `database/schema.sql` |
| 인증 | `@fastify/jwt` (Bearer), 미디어 URL용 HMAC `exp`/`sig` |
| 기타 | `@fastify/cors`, `@fastify/rate-limit`, `@fastify/static`, `@fastify/multipart`, chokidar, music-metadata, sharp, ulid |

---

## 폴더 구조

```
backend/
├── database/
│   ├── schema.sql          # 테이블 정의
│   └── lazidrome.db        # (실행 시 생성) SQLite, WAL
├── build-info.json         # 배포 빌드 시각 (루트 npm run build:info)
├── src/
│   ├── index.js            # 앱 진입, 전역 JWT 훅, rate limit, listen
│   ├── db.js               # initDB(), getDB(), 경량 마이그레이션
│   ├── constants/
│   ├── routes/             # URL prefix 연결
│   ├── handlers/           # HTTP 계층
│   ├── services/           # 스캔, 스트림, Last.fm, 플레이리스트 …
│   ├── repositories/       # SQL
│   └── lib/                # apiAuthPolicy, mediaSign, fileHash, httpErrors, safeUrl …
├── .env.example
└── package.json
```

흐름: **`routes/*` → `handlers/*` → `services/*` / `repositories/*`**

---

## 실행 방법

```bash
cd backend
cp .env.example .env   # 값 채우기
npm install
npm run dev
```

| 항목 | 값 |
|------|-----|
| 기본 포트 | **5294** (`PORT`로 변경) |
| 개발 | nodemon으로 `src/index.js` 감시 |
| 상시 실행 | `npm run serve` (PM2 예시 스크립트) |

모노레포 루트:

```bash
npm run dev          # 백엔드 + 프론트 동시
npm run deploy       # 빌드·rsync·원격 재기동 — DEPLOY.md
npm run smoke:phase1:prod
```

---

## 환경 변수

`.env`는 **커밋하지 마세요.** 템플릿: [`.env.example`](.env.example)

| 변수 | 설명 |
|------|------|
| `ADMIN_PASSWORD` | `POST /api/auth/login` 비밀번호 (필수) |
| `JWT_SECRET` | JWT 서명 (**16자 이상**, `NODE_ENV=production`에서 미설정 시 기동 실패) |
| `CORS_ORIGINS` | 허용 origin (쉼표 구분). 예: `https://lazidrome.hwaryong.com` |
| `PORT` | listen 포트 (기본 5294) |
| `TRACKS_PATH` | 스캐너 음원 루트 (기본 `./storage/tracks`) |
| `IMAGES_PATH` | 커버·정적 이미지 (기본 `./storage/images`) |
| `LASTFM_API_KEY` | Last.fm 메타·검색 (없으면 해당 기능만 실패) |
| `LASTFM_API_SECRET` | 스크롭 서명용 (선택) |
| `LASTFM_SESSION_KEY` | 스크롭 세션 (선택, Secret과 쌍) |
| `STREAM_PREVIEW_SECONDS` | 비인증 스트림 미리듣기 길이 (기본 30초 등) |
| `MEDIA_TOKEN_TTL_SEC` | 스트림·이미지 HMAC TTL(초), 기본 7200 |

`GET /api/settings`(JWT)와 `GET /api`(공개)에서 Last.fm·`build` 요약을 노출합니다. 비밀 값은 내려가지 않습니다.

---

## 데이터베이스 (`src/db.js`)

- **`initDB()`**: `track_filedata` 존재 여부로 초기 설치 판단 → 없으면 `schema.sql` 실행. WAL·외래키 PRAGMA.
- **`getDB()`**: better-sqlite3 싱글톤.
- 기존 DB용 소규모 마이그레이션(예: `albums.description`)이 코드에 포함될 수 있습니다.

---

## 스캐너 (`src/services/scanner.js`)

- **`startScanner(watchPath)`**: chokidar로 `TRACKS_PATH` 감시.
- 확장자: `.mp3`, `.flac`, `.wav`, `.m4a`, `.ogg`, `.aac` 등.
- 경로 어디에든 **`_excluded`** 폴더(예: `/music/_excluded`, `/music/Artist/_excluded`) 아래는 감시·스캔하지 않음.
- 추가·변경 시 **`src/lib/fileHash.js`** 스트리밍 SHA-256, `music-metadata` 파싱 후 트랙·앨범·아티스트 관계 갱신.
- `awaitWriteFinish`로 복사 중간 상태 파싱 완화.

---

## 인증·보안

### 로그인

- **`POST /api/auth/login`** — `{ "password": "..." }` 가 `ADMIN_PASSWORD`와 일치하면 JWT(기본 30일).
- 로그인 경로: **15분당 10회** rate limit.

### 전역 API 보호 (`src/lib/apiAuthPolicy.js`)

대부분 `/api/*`는 **`Authorization: Bearer`** 필수. 예외(공개):

| 경로 | 비고 |
|------|------|
| `GET /api` | 헬스 + `build` |
| `POST /api/auth/login` | 로그인 |
| `GET /api/stream/:id` | 핸들러에서 서명/JWT 유무로 전체/프리뷰 분기 |
| `GET /api/images/*` | 핸들러에서 `exp`/`sig` 또는 JWT |

`OPTIONS` preflight는 JWT 검사에서 제외됩니다.

### 미디어 서명 (스트림·커버)

- **`POST /api/auth/media-sign`** (JWT, 120/분): 트랙 ID별 **`exp` + `sig`** 발급.
- 프론트는 `<audio>`/`<img>` URL에 쿼리로 붙입니다 (`MEDIA_TOKEN_TTL_SEC`, 기본 2시간).
- 레거시 `?token=` JWT는 이미지 등 일부에서 호환 가능; 재생 기록 `POST …/play`는 **Bearer만**.

### 기타

- CORS: `CORS_ORIGINS` 화이트리스트.
- 외부 이미지 URL: `lib/safeUrl.js` SSRF 차단.
- 업로드: 확장자 allowlist + 인증.
- API 오류: `lib/httpErrors.js` — 내부 `err.message` 노출 최소화.

### Rate limit (대표)

| 대상 | 한도 |
|------|------|
| 전역 | 기본 fastify-rate-limit |
| enrich (트랙·앨범·아티스트) | 30/분 |
| upload | 15/시간 |
| external search | 40/분 |
| media-sign | 120/분 |

---

## API 개요

세부 body·쿼리는 각 `handlers`를 참고하세요.

| 영역 | 예시 |
|------|------|
| 인증 | `POST /api/auth/login`, `POST /api/auth/media-sign` |
| 설정 | `GET /api/settings` — Last.fm 상태, `build`, `library.trackCount` |
| 트랙 | `GET /api/tracks?limit=&offset=` 페이지 `{ items, total, hasMore }`; `?q=` 검색; `?ids=` 일괄. `PATCH`, `POST …/play`, enrich, rate |
| 스트림 | `GET /api/stream/:id` — Range, 인증 시 전체 / 미인증 프리뷰 |
| 아티스트·앨범 | 목록·상세·`PATCH`·`POST …/enrich` |
| 이미지 | `GET /api/images/{album\|track\|artist\|playlist\|tag}/…` |
| 태그 | `GET /api/tags`, `detail`, `PATCH /rename`, `POST /image` |
| 검색 | `GET /api/search/external/album` |
| 플레이리스트 | CRUD, 트랙 추가·정렬; 스마트 믹스 `LIMIT` **최대 200** (`playlistService.clampMixLimit`) |
| 홈 선반 | `GET /api/home/shelves` — (API 유지, 프론트 홈은 주로 stats·방문 기록 사용) |
| 통계 | `GET /api/stats/plays?range=`, `GET /api/stats/top?range=&limit=` |
| YouTube 가져오기 | `POST /api/import/youtube/resolve`, `POST /api/import/youtube/start`, `GET /api/import/youtube/jobs/:id` |

헬스: **`GET /api`** → `{ message, db, build }`.

---

## YouTube 가져오기 (`src/services/youtubeImportService.js`)

브라우저에서 YouTube URL을 붙여넣으면 메타데이터를 편집한 뒤 서버가 **yt-dlp + ffmpeg**로 MP3를 추출해 `TRACKS_PATH`에 저장합니다. 스캐너가 자동으로 DB에 반영합니다.

### 서버 의존성

```bash
# Debian/Ubuntu 예시
sudo apt install ffmpeg
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

`.env` (선택):

| 변수 | 기본값 |
|------|--------|
| `YT_DLP_BIN` | `yt-dlp` |
| `FFMPEG_BIN` | `ffmpeg` |
| `IMPORT_TEMP_DIR` | `/dev/shm/lazidrome-import` |

### 저장 경로

- 아티스트 + 앨범 → `{TRACKS_PATH}/{artist}/{album}/제목.mp3`
- 아티스트만 → `{TRACKS_PATH}/{artist}/제목.mp3`
- 둘 다 비어 있음 → `{TRACKS_PATH}/제목.mp3`

### 수동 테스트 체크리스트

1. 서버에 `yt-dlp`, `ffmpeg` 설치 후 `yt-dlp --version` 확인
2. 프론트 로그인 → 아무 페이지에서 YouTube **단일 영상** URL Ctrl+V → 확인 → `/download` 이동
3. 메타 편집 후 가져오기 → 진행률 100% → 곡 목록에 반영 (스캐너 몇 초 대기)
4. **플레이리스트** URL 붙여넣기 → 전체 목록·체크박스·공통 아티스트/앨범 적용
5. 입력 칸(`input`) 안에서 붙여넣기 시 **일반 paste** 동작 유지
6. 비공개·연령 제한 영상 → 오류 메시지 표시, 다른 곡은 계속 진행 (플레이리스트)

---

## Last.fm (`src/services/lastfmService.js`)

- **읽기**: enrich, 외부 앨범 검색 — `LASTFM_API_KEY`.
- **스크롭(쓰기)**: `LASTFM_API_KEY` + `LASTFM_API_SECRET` + `LASTFM_SESSION_KEY` **모두** 있을 때만. `POST /api/tracks/:id/play`로 절반 이상 재생 확정 후 비동기 `track.scrobble`. UI는 Last.fm 사이트에서 확인.

### `LASTFM_SESSION_KEY` 발급 (요약)

1. [API 계정](https://www.last.fm/api/account/create)에서 Key·Secret 발급.
2. 브라우저: `https://www.last.fm/api/auth?api_key=KEY&cb=http://127.0.0.1:9999/cb` → 승인 후 `token` 복사.
3. `auth.getSession` + api_sig로 `session.key` 수신 → `.env`의 `LASTFM_SESSION_KEY`.
4. Secret·Session은 커밋 금지.

자세한 스모크: 위 **운영 스모크**는 [../docs/PHASE1_SMOKE.md](../docs/PHASE1_SMOKE.md) 및 Settings Last.fm 안내와 동일 흐름입니다.

---

## `src/lib` 요약

| 파일 | 역할 |
|------|------|
| `apiAuthPolicy.js` | 공개 `/api` 경로 판별 |
| `mediaSign.js` / `mediaAuth.js` | 스트림·이미지 HMAC 서명·검증 |
| `envConfig.js` | `JWT_SECRET` 등 운영 검증 |
| `fileHash.js` | 스트리밍 SHA-256 (스캐너·업로드) |
| `httpErrors.js` | 클라이언트 안전 오류 응답 |
| `safeUrl.js` | 외부 URL SSRF 차단 |
| `buildInfo.js` | `build-info.json` 읽기 |
| `downloader.js` | 원격 이미지 다운로드 |

---

## 배포·버전 표시

루트 `npm run build:info`가 **`backend/build-info.json`** 을 생성합니다. rsync 시 `.env`·`node_modules`·`storage/`는 제외([`.rsync-ignore`](../.rsync-ignore)). 배포 후 프론트 Settings에서 프론트·백엔드 `builtAt` 일치 여부를 확인합니다.

---

## 문제 해결

| 증상 | 조치 |
|------|------|
| DB 잠금 | WAL `-shm`/`-wal` 확인, 백업 후 재시작·권한 |
| 스캔 안 됨 | `TRACKS_PATH`·읽기 권한 |
| 401 on API | JWT 만료, `JWT_SECRET`·`CORS_ORIGINS` |
| 스트림 짧게만 됨 | 미인증 프리뷰 — 로그인·`media-sign` 확인 |
| 502 (nginx) | 5294에서 프로세스 미기동 — `npm run deploy` 또는 `deploy:restart` |
| production 기동 실패 | `JWT_SECRET` 16자+ 설정 |

---

## 스크립트 요약

| 명령 | 설명 |
|------|------|
| `npm run dev` | nodemon 개발 |
| `npm run serve` | PM2 예시 기동 |
| `npm start` | `node src/index.js` |
