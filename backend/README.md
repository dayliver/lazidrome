# Lazidrome 백엔드

SQLite 기반 음원 라이브러리 API와 스트리밍을 제공하는 **Fastify** 서버입니다. 로컬(또는 마운트) 경로의 오디오 파일을 감시해 DB에 반영하고, JWT로 API·스트림 접근을 제어합니다.

프론트엔드 개발·배포는 [../frontend/README.md](../frontend/README.md)를 참고하세요.

---

## 기술 스택

| 구분 | 사용 |
|------|------|
| 런타임 | Node.js (ESM, `"type": "module"`) |
| 웹 프레임워크 | Fastify 5 |
| DB | better-sqlite3, `database/schema.sql` |
| 인증 | `@fastify/jwt` (Bearer + 스트림용 `?token=` 쿼리) |
| 기타 | `@fastify/cors`, `@fastify/static`, `@fastify/multipart`, chokidar, music-metadata, sharp, ulid |

---

## 폴더 구조

```
backend/
├── database/
│   ├── schema.sql          # 테이블 정의
│   └── lazidrome.db        # (실행 시 생성) SQLite DB, WAL 모드 사용
├── src/
│   ├── index.js            # Fastify 앱, 플러그인·라우트 등록, listen
│   ├── db.js               # DB 연결, initDB(), getDB(), 경량 마이그레이션
│   ├── constants/          # 예: roles.js (아티스트 역할 비트마스크)
│   ├── routes/             # URL prefix별 라우트만 얇게 연결
│   ├── handlers/           # 요청/응답 처리 (HTTP 계층)
│   ├── services/         # 비즈니스 로직 (스트림, 스캔, Last.fm, 이미지 등)
│   ├── repositories/     # SQL 위주 (tracks, home, stream 등)
│   └── lib/                # 순수 유틸 (해시, 파서, 다운로더 등)
├── .env                    # (로컬) ADMIN_PASSWORD, JWT_SECRET, 경로 등
└── package.json
```

HTTP 흐름은 대략 **`routes/*` → `handlers/*` → `services/*` / `repositories/*`** 입니다.

---

## 실행 방법

```bash
cd backend
npm install
npm run dev
```

- 기본 포트: **`5294`** (`PORT` 환경 변수로 변경).
- 개발 시 [nodemon](https://nodemon.io/)으로 `src/index.js`를 감시합니다.
- PM2로 상시 실행하려면: `npm run serve` (스크립트는 `pm2 start ./src/index.js --name "lazidrome-backend"`).

---

## 환경 변수 (주요)

| 변수 | 설명 |
|------|------|
| `ADMIN_PASSWORD` | `POST /api/auth/login` 시 비밀번호와 비교 |
| `JWT_SECRET` | JWT 서명 키 (미설정 시 코드 내 fallback 사용 — 운영에서는 반드시 설정) |
| `TRACKS_PATH` | 스캐너가 감시할 음원 루트 (기본 `./storage/tracks`) |
| `IMAGES_PATH` | 커버 등 이미지 저장·`@fastify/static` 루트 (기본 `./storage/images`) |
| `LASTFM_API_KEY` | Last.fm 메타 보강·외부 앨범 검색 등 (`lastfmService`) — 없으면 해당 기능만 실패 |
| `LASTFM_API_SECRET` | (선택) `track.scrobble` 서명용. `LASTFM_SESSION_KEY`와 함께 설정 시 재생 기록 확정 시 스크롭 시도 |
| `LASTFM_SESSION_KEY` | (선택) Last.fm `auth.getSession` 등으로 발급받은 세션 키. API Secret과 쌍으로 스크롭에 사용 |
| `STREAM_PREVIEW_SECONDS` | 비인증 시 스트림 미리듣기 길이 제한 등에 사용 (핸들러에서 참조) |

`.env`는 저장소에 커밋하지 말고, 서버 환경에만 두는 것을 권장합니다.

---

## 데이터베이스 (`src/db.js`)

- **`initDB()`**: `track_filedata` 테이블 존재 여부로 초기 설치 여부를 판단하고, 없으면 `schema.sql`을 실행합니다. WAL·외래키 등 PRAGMA를 설정합니다.
- **`getDB()`** / default export: 다른 모듈에서 `better-sqlite3` 인스턴스에 접근할 때 사용합니다.
- 기존 DB에 컬럼이 없을 때를 위한 소규모 마이그레이션(예: `albums.description`)이 코드에 포함될 수 있습니다.

---

## 스캐너 (`src/services/scanner.js`)

- **`startScanner(watchPath)`**: [chokidar](https://github.com/paulmillr/chokidar)로 디렉터리를 감시합니다.
- 지원 확장자 예: `.mp3`, `.flac`, `.wav`, `.m4a`, `.ogg`, `.aac`.
- 파일 추가·변경 시 SHA-256 해시·`music-metadata` 파싱 후 `track_filedata` 및 트랙/앨범/아티스트 관계를 트랜잭션으로 갱신합니다. `awaitWriteFinish`로 복사 중간 상태 파싱을 줄입니다.
- 해시는 스캐너 내부 구현을 쓰며, 스트리밍 해시가 필요하면 `src/lib/hasher.js`의 `getFileHash`를 참고할 수 있습니다.

---

## 인증

- 로그인: **`POST /api/auth/login`** — body `{ "password": "..." }` 가 `ADMIN_PASSWORD`와 일치하면 JWT 발급(기본 만료 30일).
- 보호 API: 대부분 `Authorization: Bearer <token>` .
- **오디오 스트림**: 브라우저 `<audio>`는 커스텀 헤더를 붙이기 어려워 **`GET /api/stream/:id?token=<jwt>`** 형태를 지원합니다 (`authenticate` 데코레이터에서 쿼리 우선 검증).

---

## API 개요 (`src/routes/*`)

아래는 대표 경로이며, 세부 쿼리·body는 각 `handlers`·서비스를 참고하면 됩니다.

| 영역 | 예시 |
|------|------|
| 인증 | `POST /api/auth/login` |
| 트랙 | `GET /api/tracks`, `PATCH /api/tracks/:id`, `PATCH /api/tracks/:id/rate`, `POST /api/tracks/:id/play`, `POST /api/tracks/:id/enrich`, `POST /api/tracks/upload` |
| 스트림 | `GET /api/stream/:id` |
| 아티스트 | `GET /api/artists`, `GET /api/artists/:id`, `PATCH /api/artists/:id`, `POST /api/artists/:id/enrich` |
| 앨범 | `GET /api/albums`, `GET /api/albums/:id`, `PATCH /api/albums/:id`, `POST /api/albums/:id/enrich` |
| 이미지 | `GET /api/images/{album\|track\|artist\|playlist}/:id`, `GET /api/images/tag?...` |
| 태그 | `GET /api/tags`, `GET /api/tags/detail`, `PATCH /api/tags/rename`, `POST /api/tags/image`, `POST /api/tags/clear-cache` |
| 검색 | `GET /api/search/external/album` (Last.fm 등 외부) |
| 플레이리스트 | `GET/POST /api/playlists`, `GET/PUT/DELETE /api/playlists/:id`, 트랙 추가·정렬·삭제 등 |
| 홈 선반 | `GET /api/home/shelves` — `mostPlayed`, `recentPlays`, `rediscover`, `starred` (각 최대 20곡). 쿼리 `window`(24h, 48h, 7d), `limit`(응답 메타). JWT 필요 |
| 통계 | `GET /api/stats/plays?range=` — `24h` \| `48h` \| `7d` \| `30d` \| `all`. 시계열(`series`)·시간대 4버킷(`timeOfDay`)·`timezonePolicy` 포함. JWT 필요 |
| 통계 | `GET /api/stats/top?range=&limit=` — 기간 내 `play_history` 이벤트 수 기준 상위 트랙·앨범. JWT 필요 |

헬스 체크: **`GET /api`** → `{ message, db }` 형태 응답.

---

## Last.fm (`src/services/lastfmService.js`)

- **메타데이터 보강**(트랙/앨범/아티스트 enrich), **외부 앨범 검색** 등 읽기 API 호출에 `LASTFM_API_KEY`를 사용합니다.
- **스크롭(쓰기, UI 없음)**: Lazidrome에는 Last.fm 통계 화면이 없습니다. 설정만 맞추면 서버가 Last.fm으로만 `track.scrobble`을 보내고, **[Last.fm 프로필](https://www.last.fm/)**에서 들은 기록을 확인하면 됩니다.
- **발동 조건**: `LASTFM_API_KEY`, **`LASTFM_API_SECRET`**, **`LASTFM_SESSION_KEY`**가 **모두** 있을 때만 호출합니다. `POST /api/tracks/:id/play`로 **절반 이상 재생**이 `play_history`에 확정된 직후, 응답을 막지 않는 **비동기** 호출입니다. 성공 시에만 `play_history.scrobbled = 1`입니다. 실패·스킵은 서버 로그(`Last.fm scrobble …`)와 DB의 `scrobbled`(0 유지)로 확인합니다.

### `LASTFM_SESSION_KEY` 수동 발급 (웹 브라우저 + 한 번 호출)

1. [API 계정](https://www.last.fm/api/account/create)에서 **API Key**, **Shared Secret**을 발급합니다 (이미 있으면 재사용).
2. 브라우저에서 아래 URL을 엽니다. `YOUR_API_KEY`와 콜백 URL을 바꿉니다. (콜백은 임의의 **로컬 HTTP** 주소면 됩니다. 예: `http://127.0.0.1:9999/cb` — 미리 `python -m http.server 9999` 등으로 열어두면 주소창에 붙는 `token`을 보기 쉽습니다.)
   - `https://www.last.fm/api/auth?api_key=YOUR_API_KEY&cb=http://127.0.0.1:9999/cb`
3. Last.fm에 로그인·승인 후, 콜백 URL로 리다이렉트되며 쿼리에 **`token`** 이 붙습니다. 그 값을 복사합니다.
4. **auth.getSession** 호출로 세션 키를 받습니다. 파라미터 `api_key`, `method`(문자열 `auth.getSession`), `token`으로 [api_sig](https://www.last.fm/api/authspec) 규칙에 따라 MD5 서명한 뒤 GET 합니다.

   예시 (서명은 Secret으로 직접 계산해야 합니다):

   `http://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=YOUR_KEY&token=TOKEN_FROM_STEP_3&api_sig=SIG&format=json`

   응답 JSON의 `session.key`가 **`LASTFM_SESSION_KEY`** 입니다. `.env`에 넣고 백엔드를 재시작합니다.

5. Secret·Session은 **저장소에 커밋하지 말고** 서버 환경에만 둡니다. 세션이 무효화되면 4번부터 다시 받습니다.

### 운영 스모크 (배포·로컬 공통 체크리스트)

1. `.env`에 `LASTFM_API_KEY`, `LASTFM_API_SECRET`, `LASTFM_SESSION_KEY` 설정 후 서버 기동.
2. 클라이언트에서 곡 재생 후 **파일 길이의 약 절반 이상** 들어 확정 재생 이벤트가 쌓이게 합니다 (`POST …/play` 호출 확인).
3. 서버 로그에 `Last.fm scrobble failed`가 없거나, 성공 후 DB에서 해당 `play_history` 행의 `scrobbled = 1` 확인.
4. Last.fm 프로필의 최근 트랙 반영까지 **몇 분 지연**될 수 있습니다.

---

## `src/lib` 요약

| 파일 | 역할 |
|------|------|
| `hasher.js` | 스트리밍 친화적 SHA-256 (`getFileHash`) |
| `artistTags.js` | 아티스트 문자열 분리·역할 마스크에 사용 |
| `metadata.js` | music-metadata 기반 유틸 (프로젝트 내 사용처는 변경될 수 있음) |
| `playlistParser.js` | 플레이리스트 형식 파싱 등 |
| `downloader.js` | 원격 이미지 등 다운로드 보조 |

---

## 문제 해결

- **DB 잠금 / 손상**: WAL 사용 중이면 `-shm` / `-wal` 파일이 함께 생길 수 있습니다. 백업 후 재시작·권한을 확인하세요.
- **스캔이 안 됨**: `TRACKS_PATH`가 실제 음원 폴더를 가리키는지, 프로세스 읽기 권한이 있는지 확인하세요.
- **401 on stream**: JWT 만료, `token` 쿼리 누락, 또는 프리뷰 모드에서 Range/길이 제한 로직을 점검하세요.
