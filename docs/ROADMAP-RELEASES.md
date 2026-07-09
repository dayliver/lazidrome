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

---

## 0.7.2 — 홈 효율 + deep watch ✅

| # | 작업 | 상태 |
|---|------|------|
| 0.7.2.1 | visits N+1 → SQL CASE name | ✅ |
| 0.7.2.2 | `GET /api/home` + 홈 1회 로드 | ✅ |
| 0.7.2.3 | stats/top `include` 슬림 (홈용) | ✅ |
| 0.7.2.4 | F6 deep watch 제거·필드 좁히기 | ✅ |

---

## 0.7.3+ — 백로그 (다음)

우선순위 미정 — 감사 B9~B25, F7–F8, F10.

| 테마 | 대표 항목 |
|------|-----------|
| 백엔드 | B9~10 N+1, B11 smart-mix `RANDOM()` |
| 프론트 | F7~8 추가 route chunk, F10 i18n |
| UX | 2.3b 모바일 HLS 큐 ([MOBILE-BACKGROUND-PLAYBACK.md](./MOBILE-BACKGROUND-PLAYBACK.md)) — 별도 논의 |

---

## 참고

- Phase 1~3 기능 로드맵: [ROADMAP.md](./ROADMAP.md)
- 감사 전체 목록·상태: [AUDIT-2026-07.md](./AUDIT-2026-07.md)
