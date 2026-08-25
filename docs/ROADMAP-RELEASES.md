# 릴리스 로드맵 (0.6.5+)

[감사 문서 AUDIT-2026-07.md](./AUDIT-2026-07.md) 우선순위 6번 이후를 **버전 단위**로 쪼갠 실행 계획입니다.  
착수 로그는 [CHANGELOG-AUDIT-2026-07.md](./CHANGELOG-AUDIT-2026-07.md)에 누적합니다.

---

## 완료

| 버전 | 요약 | 감사 항목 |
|------|------|-----------|
| **0.6.3** | 모바일 FullPlayer, 앨범 primary link | — |
| **0.6.4** | 카탈로그 페이지네이션, 가상 스크롤(그리드·큐), lazy bundle, D6 radius | B5, B6(부분), F1, F2, F9, D6 |
| **0.6.5** | /tracks 버그, visit prune 배치, 태그 상세 top-tracks 스코프 | B7, B6, tracks fix |
| **0.6.6** | 커버·스트림 HTTP 캐시 (`Cache-Control`, `ETag`) | B12, B13 |

---

## 0.6.6 — 미디어 HTTP 캐시 ✅

| # | 작업 | 상태 |
|---|------|------|
| 0.6.6.1 | 커버 `Cache-Control` / `ETag` / 304 | ✅ |
| 0.6.6.2 | 스트림·HLS manifest 캐시 | ✅ |
| 0.6.6.3 | smoke 캐시 헤더 검증 | ✅ |

---

| **0.6.7** | 앨범/아티스트 그리드 중첩 스크롤 제거 | — |
| **0.7.0** | 디자인 토큰·a11y·아티스트 상세 서버 트랙 필터 | D4, D7–D11, F5 |
| **0.7.1** | 앨범·태그 상세 서버 트랙 필터/페이지네이션 | F5 |
| **0.7.2** | 홈 대시보드 통합 API, deep watch 정리 | B8, F6 |
| **0.7.3** | 모바일 HLS CDN + hls.light 폴백 | 2.3b |
| **0.7.4** | 아티스트/앨범 삭제, 아티스트 정렬, 고아 정의, 상세 필터 자동해제 | — |
| **0.7.5** | 트랙 음량·연도, FullPlayer UX, 차트 제목 괄호 표시 | — |
| **0.8.0-alpha.1** | 재생 기록 크래시·통계 집계 복구, 외부 메타 일괄 병합 수정 | — |
| **0.8.0-alpha.2** | 재생 기록 기기 귀속·통계 기기 필터, 세션 하트비트, 기기 관리 | — |
| **0.8.0-alpha.3** | 메타데이터 저장 시 배경 트랙 목록 즉시 반영 | — |
| **0.8.0-alpha.4** | 커버 캐시 헤더 복구, rsync schema.sql 오타, 백엔드 테스트 스위트 도입 | — |

---

## 0.7.2 — 홈 효율 + deep watch ✅

| # | 작업 | 상태 |
|---|------|------|
| 0.7.2.1 | visits N+1 → SQL CASE name | ✅ |
| 0.7.2.2 | `GET /api/home` + 홈 1회 로드 | ✅ |
| 0.7.2.3 | stats/top `include` 슬림 (홈용) | ✅ |
| 0.7.2.4 | F6 deep watch 제거·필드 좁히기 | ✅ |

---

## 0.7.3 — 모바일 HLS CDN ✅

| # | 작업 | 상태 |
|---|------|------|
| 0.7.3.1 | CDN `hls.min.js` 우선 로드 + sonner CDN 실패 경고 | ✅ |
| 0.7.3.2 | 패키지 `hls.js/light` 폴백, PWA precache 제외 | ✅ |

---

## 0.7.4 — 라이브러리 정리·삭제 UX ✅

| # | 작업 | 상태 |
|---|------|------|
| 0.7.4.1 | `DELETE` 아티스트(곡 크레딧 unlink) · 앨범(수록 0만) | ✅ |
| 0.7.4.2 | 메타데이터 편집 UI 삭제·이중 확인 | ✅ |
| 0.7.4.3 | `/artists` 정렬 · 고아=트랙 링크 없음 | ✅ |
| 0.7.4.4 | 상세 트랙 필터 0건 시 자동 해제·빈 목록 안내 | ✅ |
| 0.7.4.5 | 재생목록 상세 Edit 연결 | ✅ |

---

## 0.7.5 — 트랙 메타·재생 UX ✅

| # | 작업 | 상태 |
|---|------|------|
| 0.7.5.1 | `track_metadata.volume_pct` + 재생·편집·FullPlayer 메뉴 | ✅ |
| 0.7.5.2 | 트랙 year 저장·앨범 year COALESCE 표시 | ✅ |
| 0.7.5.3 | FullPlayer 진행 썸 테두리 · ⋮ 메뉴 z-index | ✅ |
| 0.7.5.4 | 차트 트랙 제목 끝 괄호 연하게·작게 | ✅ |

---

## 0.8.0-alpha.1 — 재생 기록·통계·메타데이터 병합 복구 ✅

| # | 작업 | 상태 |
|---|------|------|
| 0.8.0-alpha.1.1 | `getTrackScrobbleMeta` 잘못된 `CAST` 수정 — 재생 1회당 프로세스 사망 | ✅ |
| 0.8.0-alpha.1.2 | 스크로블 백그라운드 작업 `.catch()` + 전역 `unhandledRejection`·`uncaughtException` | ✅ |
| 0.8.0-alpha.1.3 | `play_history.listened_sec` 실측 저장 — 기동 시 백필 없이 홈·차트 반영 | ✅ |
| 0.8.0-alpha.1.4 | External 탭 일괄 병합: stale props 연속 emit → 순수 patch 체이닝 후 단일 emit | ✅ |
| 0.8.0-alpha.1.5 | HLS 큐 peak를 곡 기준 좌표로 환산 — 스킵한 곡의 완청 오집계 방지 | ✅ |

---

## 0.8.0-alpha.2 — 기기 귀속·세션 신뢰성 ✅

| # | 작업 | 상태 |
|---|------|------|
| 0.8.0-alpha.2.1 | `play_history.device_id` + `playback_devices` 레지스트리 | ✅ |
| 0.8.0-alpha.2.2 | 통계 기기 스코프 필터 · 기기별 `exclude_from_stats` | ✅ |
| 0.8.0-alpha.2.3 | 기기별 재생 기록 삭제(기간 지정) + play_count 재계산 | ✅ |
| 0.8.0-alpha.2.4 | 세션 하트비트(앱 레벨 pong) · "응답 없음" 배지 · 갱신 경과 표시 | ✅ |
| 0.8.0-alpha.2.5 | 모든 기기 정지 브로드캐스트 | ✅ |
| 0.8.0-alpha.2.6 | 마지막 재생 세션 영속화 · 설정 기기 관리 UI(이름 변경 포함) | ✅ |
| 0.8.0-alpha.2.7 | 재생 이관 시 위치 보존 · 원격 진행바 보간 | ✅ |
| 0.8.0-alpha.2.8 | statsRepository 죽은 코드 제거(약 130줄) | ✅ |

---

## 0.8.0-alpha.3 — 트랙 목록 즉시 반영 ✅

| # | 작업 | 상태 |
|---|------|------|
| 0.8.0-alpha.3.1 | `useTracksPageQuery`·`useScopedTracksPageQuery`에 `trackExternalSync` 구독 추가 | ✅ |

서버 페이지네이션 도입 이후 이 목록들이 Pinia `library.tracks`와 별개 배열을 들게 되면서
메타데이터 저장 브로드캐스트를 아무도 받지 못하고 있었다. `/tracks`와 앨범·아티스트·태그
상세의 트랙 목록이 다이얼로그를 닫는 즉시 갱신된다.

---

## 0.8.0-alpha.4 — 커버 캐시·배포 스크립트·테스트 ✅

| # | 작업 | 상태 |
|---|------|------|
| 0.8.0-alpha.4.1 | `reply.sendFile`이 덧씌우던 `public, max-age=0`·약한 ETag 차단 → 서명 기반 private 캐시 복구 | ✅ |
| 0.8.0-alpha.4.2 | `.rsync-ignore` `scheme.sql` → `schema.sql` 오타 수정 | ✅ |
| 0.8.0-alpha.4.3 | `LAZI_DB_PATH` 주입 + `node --test` 백엔드 테스트 28개 | ✅ |

0.6.6에서 넣은 커버 HTTP 캐시가 실제로는 동작한 적이 없었다 — `@fastify/static`이
핸들러가 설정한 헤더를 전부 덮어쓰고 있었다. 스모크의 `Image conditional GET` 실패도
Cloudflare가 아니라 이 문제였다.

---

## 0.7.6+ — 백로그 (다음)

우선순위 미정 — 감사 B9~B25, F7–F8, F10 · stats 타임존 수정.

| 테마 | 대표 항목 |
|------|-----------|
| 백엔드 | B9~10 N+1, B11 smart-mix `RANDOM()` |
| 프론트 | F7~8 추가 route chunk, F10 i18n |
| UX | stats 습관 차트 타임존 · /stats 개편 |

---

## 참고

- Phase 1~3 기능 로드맵: [ROADMAP.md](./ROADMAP.md)
- 감사 전체 목록·상태: [AUDIT-2026-07.md](./AUDIT-2026-07.md)
