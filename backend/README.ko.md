# Lazidrome — 백엔드

**Lazidrome**의 API, SQLite 라이브러리 DB, 폴더 스캐너, 오디오 스트리밍을 담당합니다.

[English](./README.md) · [프로젝트 루트](../README.ko.md) · [프론트엔드](../frontend/README.ko.md)

---

## 이 패키지가 하는 일

- Fastify HTTP API (`/api`)
- `TRACKS_PATH` 감시 후 오디오를 SQLite에 인덱싱
- 트랙 스트리밍 (인증·서명 시 전체 / 미인증 시 짧은 미리듣기)
- 커버 이미지 제공; Last.fm 보강·YouTube 가져오기(선택)
- 비밀번호 로그인 → JWT; 미디어 URL은 단기 HMAC 서명 사용

---

## 요구 사항

- Node.js 20+ (20.19+ 권장)
- SQLite(`database/`)·이미지 저장용 쓰기 권한
- 선택: **ffmpeg**, **yt-dlp** (가져오기·태그 기록)

---

## 설정

```bash
cd backend
cp .env.example .env
# 최소한 ADMIN_PASSWORD, JWT_SECRET(16자 이상) 설정

npm install   # 또는 모노레포 루트에서 설치
npm run dev   # nodemon으로 src/index.js 실행
```

기본 주소: **http://localhost:5294**

모노레포 루트에서 `npm run dev`를 실행하면 백엔드와 프론트가 함께 뜹니다.

헬스 체크: `GET /api` → `{ message, db, build }`.

---

## 환경 변수

`.env`는 커밋하지 마세요. 템플릿: [`.env.example`](./.env.example)

| 변수 | 설명 |
|------|------|
| `ADMIN_PASSWORD` | 로그인 비밀번호 (**필수**) |
| `JWT_SECRET` | JWT 서명 키 (**16자 이상**; 운영에서 필수) |
| `PORT` | listen 포트 (기본 `5294`) |
| `TRACKS_PATH` | 음원 루트 (기본 `./storage/tracks`) |
| `IMAGES_PATH` | 커버·정적 이미지 (기본 `./storage/images`) |
| `CORS_ORIGINS` | 허용 브라우저 origin (쉼표 구분) |
| `MEDIA_TOKEN_TTL_SEC` | 스트림·이미지 서명 TTL(초, 기본 `7200`) |
| `STREAM_PREVIEW_SECONDS` | 비인증 미리듣기 길이 |
| `LASTFM_API_KEY` | Last.fm (선택) |
| `YT_DLP_BIN` / `FFMPEG_BIN` | YouTube 가져오기용 경로 (선택) |
| `IMPORT_TEMP_DIR` | 가져오기 임시 디렉터리 |

`TRACKS_PATH` 아래 경로 세그먼트에 `_excluded`가 있으면 스캐너가 건너뜁니다.

---

## 오디오 형식

업로드와 스캔이 공유하는 확장자 예:

`.mp3` · `.flac` · `.m4a` · `.aac` · `.ogg` · `.opus` · `.wav` · `.wma` · `.ape` · `.alac`

---

## 구조

```
backend/
├── database/          # schema.sql + 실행 시 생성되는 SQLite
├── src/
│   ├── index.js       # 앱 진입
│   ├── db.js
│   ├── routes/
│   ├── handlers/
│   ├── services/      # 스캐너, 스트림, 가져오기 등
│   ├── repositories/
│   └── lib/
├── .env.example
└── package.json
```

흐름: **routes → handlers → services / repositories**.

---

## 인증 (요약)

| 엔드포인트 | 설명 |
|------------|------|
| `POST /api/auth/login` | `{ "password" }` → JWT |
| 대부분 `/api/*` | `Authorization: Bearer …` |
| `GET /api/stream/:id` | 서명 또는 JWT → 전체; 아니면 미리듣기 |
| `GET /api/images/…` | 서명 또는 JWT |
| `POST /api/auth/media-sign` | 미디어용 `exp` / `sig` 발급 |

---

## API 개요

세부 스펙은 `src/handlers/`를 참고하세요. 주요 영역:

| 영역 | 예시 |
|------|------|
| 인증 | login, media-sign |
| 라이브러리 | tracks, albums, artists, tags, search |
| 스트림 | `GET /api/stream/:id` |
| 플레이리스트 | CRUD, 정렬, 스마트 믹스 |
| 통계·히스토리 | plays, top, play history |
| 가져오기 | 로컬 업로드 스테이징, YouTube 작업 |
| 파일 | `TRACKS_PATH` 아래 탐색·삭제 |
| 관리 | 고아 레코드 정리 등 |

---

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | nodemon 개발 실행 |
| `npm run serve` | PM2 시작 예시 |

---

## 관련 문서

- [루트 README](../README.ko.md)
- [배포](../docs/DEPLOY.md)
- [Phase 1 스모크](../docs/PHASE1_SMOKE.md)
- [로드맵](../docs/ROADMAP.md)
