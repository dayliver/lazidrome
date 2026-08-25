# Lazidrome

**Lazidrome**는 자가 호스팅 음악 라이브러리입니다. 서버(또는 NAS 경로)에 음원 파일을 두고, 브라우저에서 탐색·검색·재생할 수 있습니다. 플레이리스트, 태그, 차트, YouTube·로컬 파일 가져오기 등을 지원합니다.

| | |
|---|---|
| **버전** | 0.8.0-alpha.3 |
| **구성** | Vue 3 + Vite (웹 앱) · Fastify + SQLite (API·스트리밍) |
| **UI 언어** | 영어 · 한국어 |

[English README](./README.md)

---

## 주요 기능

- **라이브러리** — 트랙·앨범·아티스트; 폴더 감시로 DB 동기화
- **재생** — 브라우저 플레이어; 모바일 큐는 HLS로 백그라운드 재생을 돕습니다
- **플레이리스트·태그** — 컬렉션 정리와 필터
- **차트·히스토리** — 청취 통계
- **가져오기** — 로컬 업로드, YouTube (`yt-dlp` + `ffmpeg` 필요)
- **파일 탐색기** — 디스크의 음악 폴더 확인
- **메타데이터** — 태그 편집; Last.fm 보강(선택)
- **PWA** — 설치형 웹 앱
- **인증** — 비밀번호 로그인(JWT); 스트림·커버용 서명 URL

---

## 요구 사항

- **Node.js** 20+ (도구 호환을 위해 20.19+ 권장)
- 음원 라이브러리용 디스크 공간
- 선택: **ffmpeg** (태그 기록·YouTube 가져오기), **yt-dlp** (YouTube)
- 선택: [Last.fm API 키](https://www.last.fm/api) (외부 메타 검색)

---

## 빠른 시작

```bash
git clone https://github.com/dayliver/lazidrome.git
cd lazidrome
npm install

cp backend/.env.example backend/.env
# backend/.env 편집 — ADMIN_PASSWORD, JWT_SECRET(16자 이상) 설정

# 음원을 tracks 경로에 두세요 (기본: backend/storage/tracks)
# 또는 backend/.env 의 TRACKS_PATH 를 지정하세요

npm run dev
```

| 서비스 | 주소 |
|--------|------|
| 웹 UI | http://localhost:3000 |
| API | http://localhost:5294 |

UI를 열고 `ADMIN_PASSWORD`로 로그인한 뒤, 스캐너가 파일을 등록할 때까지 잠시 기다리면 됩니다.

---

## 프로젝트 구조

```
lazidrome/
├── frontend/     # Vue 웹 앱 (PWA)
├── backend/      # Fastify API, SQLite, 스캐너, 스트리밍
├── docs/         # 추가 가이드 (배포, 스모크, 로드맵)
└── package.json  # 워크스페이스 스크립트
```

- 프론트엔드: [frontend/README.ko.md](./frontend/README.ko.md)
- 백엔드: [backend/README.ko.md](./backend/README.ko.md)

---

## 설정 요약

`backend/.env.example`을 `backend/.env`로 복사합니다. 주요 변수:

| 변수 | 용도 |
|------|------|
| `ADMIN_PASSWORD` | 로그인 비밀번호 |
| `JWT_SECRET` | JWT 서명 키 (운영 환경 필수, 16자 이상) |
| `PORT` | API 포트 (기본 `5294`) |
| `TRACKS_PATH` | 음원 루트 폴더 |
| `IMAGES_PATH` | 커버 등 이미지 |
| `CORS_ORIGINS` | 허용 웹 origin (쉼표 구분) |
| `LASTFM_API_KEY` | Last.fm (선택) |

`TRACKS_PATH` 아래 어디에든 `_excluded` 폴더가 있으면 스캐너가 무시합니다.

---

## 루트 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | API + UI 동시 실행 |
| `npm run build` | 빌드 정보 기록 후 프론트 빌드 |
| `npm run install-all` | 워크스페이스 의존성 설치 |

운영 배포 스크립트는 `scripts/`에 있으며 [docs/DEPLOY.md](./docs/DEPLOY.md)를 참고하세요.

---

## 지원 오디오 (일반)

**MP3, FLAC, M4A/AAC, OGG/Opus, WAV** 등 업로드·스캔에서 허용하는 형식을 사용합니다. 자세한 목록은 [backend/README.ko.md](./backend/README.ko.md)를 보세요.

---

## 라이선스

패키지 메타데이터 기준(`ISC`). 포크 시 필요에 맞게 조정하세요.

---

## 링크

- [English README](./README.md)
- [Frontend](./frontend/README.md) · [Frontend (한국어)](./frontend/README.ko.md)
- [Backend](./backend/README.md) · [Backend (한국어)](./backend/README.ko.md)
- [로드맵](./docs/ROADMAP.md)
