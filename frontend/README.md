# Lazidrome 프론트엔드

이 저장소의 **웹 UI(프론트엔드 앱)** 입니다. Node 백엔드가 제공하는 REST API와 오디오 스트림을 사용해, 서버에 둔 음원 라이브러리를 브라우저에서 탐색·재생합니다.

백엔드 구조·스캐너·DB는 [../backend/README.md](../backend/README.md)를 참고하세요.

---

## 기술 스택

| 구분 | 사용 |
|------|------|
| 프레임워크 | Vue 3 (`<script setup>`), Vue Router 5 |
| 상태 | Pinia |
| 빌드 | Vite 8, TypeScript (`vue-tsc`) |
| 스타일 | Tailwind CSS 4 (`@tailwindcss/vite`) |
| UI | Reka UI, class-variance-authority, Lucide 아이콘 |
| PWA | `vite-plugin-pwa` (매니페스트 + Service Worker, 정적 자산 프리캐시) |

오디오 재생은 **HTML `<audio>`(단일 엘리먼트)** 기반이며, 스트림 URL에는 쿼리 `token`으로 인증합니다.

---

## 사전 요구 사항

- Node.js 20+ 권장  
- 로컬 개발 시 **백엔드가 `http://localhost:5294`에서 동작**해야 합니다. Vite는 `/api`를 해당 주소로 프록시합니다.

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

```bash
npm run build
```

출력 디렉터리: `frontend/dist/` (정적 파일 + `manifest.webmanifest`, `sw.js` 등 PWA 산출물)

### 빌드 결과 미리보기

```bash
npm run preview
```

`preview`는 빌드된 `dist`를 서빙합니다. API까지 쓰려면 백엔드를 띄우고, 동일 오리진이 아니면 `vite.config.ts`의 `preview.proxy` 등 별도 설정이 필요할 수 있습니다.

---

## 환경 변수

프론트는 런타임에 `import.meta.env`를 사용합니다. 필요 시 저장소 루트 또는 `frontend/`에 `.env` / `.env.development` 등을 두고 Vite 규칙(`VITE_` 접두사)에 맞게 정의하세요.

---

## 디렉터리 개요

```
frontend/
├── public/           # 정적 파일 (PWA 아이콘, icons.svg 등)
├── src/
│   ├── components/   # 화면·플레이어·폼 등 Vue 컴포넌트
│   ├── stores/       # Pinia (auth, library, player, theme …)
│   ├── router/       # 라우트 정의
│   ├── lib/          # 유틸 (예: 커버 이미지 URL)
│   ├── composables/
│   ├── views/
│   ├── App.vue
│   └── main.ts       # 엔트리 (PWA `registerSW` 포함)
├── index.html
├── vite.config.ts    # 프록시, Tailwind, PWA 플러그인
└── package.json
```

재생·대기열·Media Session·끝 구간 페이드 등은 주로 [`src/stores/player.js`](src/stores/player.js)에 있습니다.

---

## API와 인증 (요약)

- 일반 API: Pinia `auth` 스토어의 `fetchWithAuth` 등으로 호출합니다.  
- **스트리밍**: `<audio>`는 커스텀 헤더를 붙이기 어려워 `GET /api/stream/:id?token=...` 형태로 토큰을 넘깁니다.  
- 개발 시 Vite가 `/api`를 백엔드로 넘기므로, 브라우저에서는 상대 경로 `/api/...`만 써도 됩니다.

---

## PWA

- 빌드 시 웹 앱 매니페스트와 Service Worker가 생성됩니다.  
- Workbox는 **JS/CSS/HTML 등 빌드 산출물만** 프리캐시하고, `navigateFallbackDenylist`로 **`/api`는 SW가 가로채지 않도록** 했습니다.  
- **홈 화면에 추가(설치)** 는 보통 **HTTPS**에서 동작합니다. 로컬은 `localhost` 예외로 동작하는 경우가 많습니다.

아이콘은 `public/pwa-192.png`, `public/pwa-512.png`에서 교체할 수 있습니다.

---

## 사용 흐름 (사용자 관점)

1. 백엔드를 실행하고 음원 라이브러리 경로·스캔이 정상인지 확인합니다.  
2. 프론트 `npm run dev`로 UI를 연 뒤, 설정에서 **서버 URL**과 **로그인(토큰)** 을 맞춥니다.  
3. 루트 경로(`/`) **홈**에서는 `GET /api/home/shelves`로 묶인 선반(많이 들은 곡, 최근 재생, 다시 듣기, 별표)을 볼 수 있고, 카드를 누르면 해당 선반의 곡들이 대기열에 올라가 선택한 곡부터 재생됩니다.  
4. 아티스트·앨범·트랙 목록에서 재생하면 플레이어에 대기열이 쌓이고, 미니 플레이어 / 전체 화면 플레이어로 조작할 수 있습니다.  
5. 모바일 브라우저에서는 OS 미디어 컨트롤과 연동되도록 **Media Session**이 등록되어 있습니다.  
6. 상단 네비의 **통계**(`/stats`)는 자리만 잡아 둔 페이지입니다(향후 확장).

---

## 문제 해결

- **API 404 / CORS**: 개발 중에는 반드시 `npm run dev`로 Vite를 쓰고, API는 프록시를 타게 하세요.  
- **PWA 캐시가 남을 때**: 브라우저 개발자 도구 → Application → Service Workers에서 unregister 후 새로고침하거나, 시크릿 창으로 확인하세요.  
- **빌드 타입 오류**: `npm run build` 전에 `vue-tsc -b`가 실행됩니다. `src/env.d.ts`에 `vite/client` 및 PWA 클라이언트 타입 참조가 있습니다.

---

## 스크립트 요약

| 명령 | 설명 |
|------|------|
| `npm run dev` | Vite 개발 서버 (포트 3000, `/api` → 5294) |
| `npm run build` | 타입 검사 + 프로덕션 번들 |
| `npm run preview` | `dist` 미리보기 |
