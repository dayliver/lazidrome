# 감사 착수 변경 로그 (2026-07-09)

[AUDIT-2026-07.md](./AUDIT-2026-07.md) 권장 1~4항 구현 요약.

## 1. 백엔드 인덱스 + 통계 SQL (B1, B2)

- `ensurePerformanceIndexes()` 마이그레이션: hot path 7종 인덱스
- `track_filedata.mtime_ms` 컬럼 — 스캐너 변경 감지
- `loadPlayHistoryEvents(range, timezone)`: SQL `played_at >= cutoff` 필터
- `getStatsTopPayload`: 기간 이벤트 1회 로드 → tracks/albums/artists/totals

## 2. 스캐너 + 업로드 dedup (B3, B4)

- 스캔 전 `(path, size, mtime_ms)` 비교 → 변경 없으면 SHA-256/파싱 스킵
- `recentIngestPaths.js`: 스캔 성공·mtime 스킵 후 45s 동안 동일 경로 재스캔 방지 (chokidar add+change 중복)
- 업로드/YouTube는 DB 삽입 없이 파일만 기록 → ingest는 스캐너 단일 경로

## 3. UI 공용화 + 라이트 모드 (D1~D3, D5, D4 일부)

- `FavoriteButton`, `StarRating`, `LoadingSpinner`, `EmptyState` — 테이블·뷰·플레이어·필터에 적용
- `FullPlayerHeader`: shadcn `DropdownMenu` (수동 v-if 메뉴 제거)
- `style.css`: `--favorite`, `--rating` 시맨틱 토큰
- 플레이어/큐: `border-border`, Slider 썸 `bg-background`

## 4. 커버 서명 (F3, F4)

- `auth.js`: `resourceVersions` Map — 배치 서명 시 해당 리소스만 재렌더
- `SafeImage`: `signType`/`signId` + IntersectionObserver (`rootMargin 240px`)
- `AlbumGrid`/`ArtistGrid`: 뷰포트 진입 시에만 서명
- `AlbumsView`: `prefetchImageSignatures` 제거

## 5. 카탈로그 페이지네이션 + 가상 스크롤 + 번들 분리 (B5, B6, F1, F2, F9, D6)

### 백엔드 (B5, B6)

- `pageQuery.js`: `parsePageQuery`, `parseSearchQuery`
- albums/artists GET: `{ items, total, offset, limit, hasMore }` (+ legacy 전량 배열 호환)
- artists 응답 top-tracks: 현재 페이지 ID만 `findTopTracksForArtistIds`
- album detail: `artists` 배열 포함

### 프론트 (F1)

- `libraryCache.js`: revision·trackCount·settings만 캐시 (카탈로그 배열 제거)
- `library.js`: revision-only boot, `fetchAlbumsPage` / `fetchArtistsPage` / `searchAlbums` / `searchArtists`
- `AlbumsView`, `ArtistsView`: load-more 페이지네이션
- `useGlobalSearch`: 서버 검색 API
- 메타데이터·상세: album/artist 검색 API 연동

### 가상 스크롤 (F2)

- `VirtualScrollGrid` + `AlbumGrid` / `ArtistGrid`
- `QueueList`, `TracksListTable`, `TrackListTableDesktop`(플레이리스트 드래그 제외)
- `TrackListTable`: md breakpoint에서 desktop/mobile 단일 마운트

### 번들 분리 (F9)

- `HomeView` lazy route
- `FullPlayer`, `MetadataEditDialog` async component

### Radius (D6)

- 카드·다이얼로그·큐 패널 `rounded-xl` 통일
- `docs/DESIGN-TOKENS.md` 추가

## 6. 0.6.5 — /tracks 버그 + visit prune + 태그 top-tracks (B7, B6)

### /tracks 버그

- `TracksListTable`: tbody 가상 스크롤 제거 (row 높이 불균일)
- `useTracksPageQuery`: append 시 새 배열 할당
- `useTrackListLocalState`: `deep: true` watch
- `countTracks()`: `filedata` join — settings·목록 total 정합

### B7 visit prune

- `pageVisitsPrune.js`: 기동 1회 + 10분 주기, 기록/import 후 60s debounce
- `findFrequentVisits`: hot path DELETE 제거, EXISTS로 유령 항목 필터

### B6 태그 상세

- `tags.detail.get.js`: `findTopTracksForArtistIds(태그 내 아티스트 ID)`

릴리스 계획: [ROADMAP-RELEASES.md](./ROADMAP-RELEASES.md)

## 7. 0.6.6 — 미디어 HTTP 캐시 (B12, B13)

- `httpCache.js`: `Cache-Control: private, max-age=…` (서명 `exp`와 정합), `ETag`, `If-None-Match` → 304
- `images.get.js`: 커버 파일 mtime/size 기반 ETag
- `stream.get.js`: 전체 스트림·프리뷰(120s) 구분 캐시
- `stream.playlist.get.js`: manifest ETag + max-age 60
- `smoke-phase1.mjs`: cache-control·304 검증

## 남은 우선 과제

- **0.7.0:** D7~D11 타이포·간격·접근성, F5 상세 필터
- B8~B25, F6~F10 백로그 — [ROADMAP-RELEASES.md](./ROADMAP-RELEASES.md)
