# Lazidrome 개선 로드맵 (Phase 1–3)

자가 호스팅 음악 라이브러리 기준으로 **보안 → 규모·안정 → UX·구조** 순으로 진행합니다.

---

## Phase 1 — 보안 (1차 구현 완료, 배포 검증 필요)

**목표:** 네트워크에 노출돼도 라이브러리가 무분별하게 조작·유출되지 않도록 한다.

| # | 작업 | 상태 | 비고 |
|---|------|------|------|
| 1.1 | 변경 API·민감 GET에 JWT (`/api/*`, 스트림·로그인 예외) | ✅ | `index.js` `preHandler` + `apiAuthPolicy.js` |
| 1.2 | `JWT_SECRET` fallback 제거, 운영 시 미설정이면 기동 실패 | ✅ | `lib/envConfig.js` |
| 1.3 | CORS `origin` 화이트리스트 (`CORS_ORIGINS`) | ✅ | |
| 1.4 | Rate limit (전역 + 로그인 강화) | ✅ | `@fastify/rate-limit` |
| 1.5 | 로그인: `ADMIN_PASSWORD` 필수·타이밍 세이프 비교 | ✅ | |
| 1.6 | 외부 이미지 URL SSRF 차단 (`downloader`) | ✅ | `lib/safeUrl.js` |
| 1.7 | 업로드: 인증(훅) + 확장자 allowlist | ✅ | `uploadService.js` |
| 1.8 | README / `.env.example` 환경 변수 문서화 | ✅ | |

**구현 파일:** `backend/src/index.js`, `lib/envConfig.js`, `lib/apiAuthPolicy.js`, `lib/safeUrl.js`, `lib/downloader.js`

**의도적으로 열어두는 것**

- `POST /api/auth/login` — 비인증
- `GET /api/stream/:id` — 핸들러 내부에서 JWT 있으면 전체, 없으면 프리뷰만
- `GET /api` — 헬스 체크

## Phase 1.5 — 미디어 서명·API 상한 (완료)

| # | 작업 | 상태 |
|---|------|------|
| 1.5.1 | `POST /api/auth/media-sign` — 스트림·이미지용 **exp/sig** (기본 TTL 2h, `MEDIA_TOKEN_TTL_SEC`) | ✅ |
| 1.5.2 | 프론트: JWT 대신 `exp`/`sig`로 스트림·커버 URL (`auth.coverSrc`, `ensureStreamSignature`) | ✅ |
| 1.5.3 | 이미지 라우트: 서명 또는 레거시 JWT (쿼리 `token` 호환) | ✅ |
| 1.5.4 | enrich 30/분, upload 15/시간, external search 40/분, media-sign 120/분 | ✅ |
| 1.5.5 | `recordTrackPlay` — 쿼리 `token` 제거 (Bearer만) | ✅ |

**구현:** `backend/src/lib/mediaSign.js`, `mediaAuth.js`, `handlers/auth.mediaSign.post.js` · `frontend/src/stores/auth.js`, `lib/mediaSign.js`

---


## Phase 2 — 규모·안정·버그

**목표:** 라이브러리가 커져도 쓸 수 있고, 깨진 UI를 고친다.

| # | 작업 | 우선 |
|---|------|------|
| 2.1 | Settings Last.fm ↔ `auth` store 연동 또는 UI 제거 | ✅ P0 — `GET /api/settings` + 서버 `.env` 안내 UI |
| 2.2 | `/api/tracks` 등 **페이지네이션** + 프론트 점진 로드 | ✅ P1 — `limit`/`offset`/`q`/`ids` + TracksView·검색 |
| 2.3 | 스캐너·업로드 **스트리밍 해시** (`readFileSync` 제거) | ✅ P1 — `lib/fileHash.js` |
| 2.3a | **모바일 재생** — 재생횟수 이중 집계 방지, 다음 곡 프리로드·백그라운드 `play()` 재시도 | ✅ P0 모바일 |
| 2.3b | **모바일 HLS 큐** — `playlist.m3u8` + CDN hls.js / light 폴백 + 네이티브 HLS | 🚧 CDN·light 완료; Phase C(트랜스코드)는 선택 — [MOBILE-BACKGROUND-PLAYBACK.md](./MOBILE-BACKGROUND-PLAYBACK.md) |
| 2.4 | 태그 rename 배치/쿼리 최적화 | ✅ P2 — `json_each` EXISTS 대상 행만 UPDATE |
| 2.5 | 플레이리스트 smart-mix `LIMIT` 상한 | ✅ P2 — 최대 200, `LIMIT ?` 파라미터 |
| 2.6 | 에러 응답에서 내부 `err.message` 노출 축소 | ✅ P2 — `lib/httpErrors.js` |

---

## Phase 3 — UX·구조·접근성

**목표:** 유지보수하기 쉽고, 일관된 사용감.

| # | 작업 | 우선 |
|---|------|------|
| 3.1 | 한/영 UI·`lang`·피드백(toast vs alert) 통일 | ✅ P1 — `lang=ko`, `lib/notify.js`, 네비·뷰 한글 |
| 3.2 | `aria-label`, 커버 `alt`, 미니 플레이어 키보드 | ✅ P2 — SafeImage·MiniPlayer |
| 3.3 | `HomeView` / `player` store 분리, 홈 composable | ✅ P2 — `useHomePage.js` |
| 3.4 | `titleParts`·External*Tab 중복 제거 | ✅ P3 — `useExternalMetadataSearch` |
| 3.5 | 미사용 `HomeTrackShelf`, `TopNavigation`, `GenresView` 정리 | ✅ P3 — 파일 삭제 |
| 3.6 | 라우트 가드·비로그인 Empty 상태 통일 | ✅ P2 — `meta.requiresAuth`, `AuthEmptyState` |

---

## 완료 기준 (체크리스트)

### Phase 1 Done

- [x] 인증 없이 `PATCH /api/tracks/:id` 등이 **401** (전역 훅)
- [x] `JWT_SECRET` 없이 `NODE_ENV=production` 기동 **실패**
- [x] `CORS_ORIGINS` 외 origin에서 브라우저 API 호출 **차단**
- [x] 로그인 10회/15분 rate limit
- [x] `http://127.0.0.1` 등 커버 URL fetch **거부** (`assertSafeExternalUrl`)
- [x] 실제 배포 환경에서 프론트 origin·스트림·이미지 exp/sig 스모크 (`npm run smoke:phase1:prod`, `docs/PHASE1_SMOKE.md`)

### Phase 2 Done

- [x] 1만 곡 규모에서도 목록 첫 화면 **체감 로딩** 개선(페이지네이션)
- [x] Settings Last.fm 저장 **오류 없음** (클라이언트 키 저장 UI 제거, 서버 상태 표시)
- [x] 스캐너·업로드 SHA-256 스트리밍 해시
- [x] 모바일: 50% 이상 청취 후 곡 전환 시 `play_count` +2 방지
- [x] 모바일: 화면 꺼짐 시 다음 곡 프리로드·재생 재시도(완전 gapless MSE는 미구현)

### Phase 3 Done

- [x] 주요 플로우 **한 언어** 기준 카피 통일 (`lang=ko`, toast, 한글 네비·헤더)
- [x] 아이콘-only 컨트롤 **스크린리더 라벨** (미니 플레이어·모바일 메뉴 등)
- [x] 비로그인 **AuthEmptyState** + `meta.requiresAuth`
- [x] 홈 로직 `useHomePage`, 외부 메타 `useExternalMetadataSearch`

---

## Phase 4 — 감사 기반 성능·UX (2026-07~)

**목표:** [AUDIT-2026-07.md](./AUDIT-2026-07.md) 권장 항목을 버전 단위로 반영.

| 버전 | 상태 | 요약 |
|------|------|------|
| 0.6.4 | ✅ | 페이지네이션, 가상 스크롤, lazy bundle |
| 0.6.5 | ✅ | /tracks fix, B7 visit prune, B6 tag detail |
| 0.6.6 | ✅ | B12~13 HTTP 캐시 |
| 0.6.7 | ✅ | 그리드 중첩 스크롤 fix |
| 0.7.0 | ✅ | D4–D11, F5 artist tracks |
| 0.7.1 | ✅ | F5 album/tag tracks |
| 0.7.2 | ✅ | B8 home dashboard, F6 deep watch |
| 0.7.3 | ✅ | 2.3b HLS CDN + hls.light |
| 0.7.4 | ✅ | 아티스트/앨범 삭제, 정렬·고아·상세 필터 |

상세 일정·체크리스트: **[ROADMAP-RELEASES.md](./ROADMAP-RELEASES.md)**

---

## 참고

- 초기 감사 요약: [AUDIT-2026-07.md](./AUDIT-2026-07.md) · [CHANGELOG-AUDIT-2026-07.md](./CHANGELOG-AUDIT-2026-07.md)
- 백엔드: [`backend/README.md`](../backend/README.md)
- 프론트: [`frontend/README.md`](../frontend/README.md)
