# Lazidrome — 프론트엔드

**Lazidrome** 웹 UI입니다. 자가 호스팅 라이브러리를 탐색·재생하고, 플레이리스트·태그를 관리하며, 음원을 가져올 수 있습니다.

[English](./README.md) · [프로젝트 루트](../README.ko.md) · [백엔드](../backend/README.ko.md)

---

## 이 패키지가 하는 일

- Vue 3 SPA (Vite + TypeScript)
- Lazidrome API(`/api`)로 라이브러리·스트리밍 연동
- PWA (설치 가능, `vite-plugin-pwa` 서비스 워커)
- UI **영어·한국어** (`vue-i18n`)

주요 화면: 홈, 트랙, 앨범, 아티스트, 플레이리스트, 태그, 차트, 히스토리, 가져오기·업로드, 파일, 설정, 관리 도구.

---

## 요구 사항

- Node.js 20+
- 실행 중인 Lazidrome **백엔드** (기본 `http://localhost:5294`)

개발 모드에서 Vite는 `/api`를 백엔드로 프록시합니다.

---

## 설정

**모노레포 루트**에서 (권장):

```bash
cd ..   # lazidrome/
npm install
npm run dev
```

이 패키지만 실행할 때 (백엔드는 이미 떠 있어야 함):

```bash
cd frontend
npm install
npm run dev
```

| | |
|---|---|
| 개발 서버 | http://localhost:3000 |
| 프로덕션 빌드 | `npm run build` (또는 루트에서 `npm run build`) |
| 빌드 미리보기 | `npm run preview` |

루트 `npm run build`는 Settings에 쓰이는 `build-info.json`도 생성합니다.

---

## 기술 스택

| 구분 | 선택 |
|------|------|
| 프레임워크 | Vue 3 (`<script setup>`), Vue Router |
| 상태 | Pinia |
| 빌드 | Vite 8, TypeScript |
| 스타일 | Tailwind CSS 4 |
| 컴포넌트 | Reka UI, Lucide |
| 재생 | HTML `<audio>`; 모바일 큐는 **hls.js** 사용 가능 |
| 미디어 URL | `POST /api/auth/media-sign`의 단기 `exp` / `sig` (쿼리에 장기 JWT를 넣지 않음) |

---

## 환경 / 프록시

개발 프록시는 로컬 API를 가리킵니다. 운영에서는 빌드된 `dist/`를 API와 같은 origin으로 제공하거나, 리버스 프록시로 `/api`를 백엔드에 연결하세요.

기본 로컬 구성에는 별도 프론트엔드 `.env`가 필요하지 않습니다.

---

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | Vite 개발 서버 |
| `npm run build` | 타입체크 + 프로덕션 번들 |
| `npm run preview` | 프로덕션 빌드 로컬 미리보기 |
| `npm run icons:generate` | PWA·앱 아이콘 재생성 |

---

## 관련 문서

- [루트 README](../README.ko.md)
- [백엔드 README](../backend/README.ko.md)
- [모바일 / HLS](../docs/MOBILE-BACKGROUND-PLAYBACK.md)
