# 모바일 UI 개선 대상

2026-11-06 조사. 구현 전 메모. 좁은 화면에서 데스크톱 가로 배치가 그대로인 화면만 모았다.

트랙 목록·홈·앨범/아티스트 그리드·차트·재생 기록·태그 그리드·햄버거 내비는 이미 모바일 레이아웃이 있다. 여기 목록에 넣지 않는다.

---

## 1순위 — 가져오기

`/import`와 `/upload`가 같은 표를 쓴다. 제목·아티스트·앨범·트랙 번호를 한 줄에 넣고, URL 입력과 확인 버튼도 가로로 붙는다. 표를 곡별 카드로 바꾸면 두 페이지가 같이 나아진다.

| 경로 | 파일 |
|------|------|
| `/import` | `frontend/src/views/ImportView.vue` |
| `/upload` | `frontend/src/views/UploadView.vue` → `frontend/src/components/import/LocalFileImportPanel.vue` |
| 공통 표 | `frontend/src/components/download/ImportTrackTable.vue` |

---

## 2순위 — 편집 창

페이지는 아니지만 폰에서 가장 쓰기 힘들다. `max-w-5xl`, `h-[85vh]`, `px-8`, 탭은 가로 스크롤.

| 진입 | 파일 | 특히 |
|------|------|------|
| 트랙·앨범·아티스트 메타 편집 | `frontend/src/components/metadata/MetadataEditDialog.vue` | 앨범 곡 목록이 디스크/트랙 번호·커버·제목·버튼을 한 줄에 둠 (`metadata/tabs/AlbumTracksTab.vue`) |
| 재생목록 만들기/수정 | `frontend/src/components/playlist/PlaylistDialog.vue` | 스마트 믹스 조건이 `160px` 셀렉트 두 개 + 입력칸 (`playlist/tabs/PlaylistBasicInfoTab.vue`, `grid-cols-3`) |
| 태그 편집 | `frontend/src/components/tags/TagEditDialog.vue` | 메타 편집과 같은 창 크기·탭 |

---

## 3순위 — 표·버튼 줄이 남은 페이지

| 경로 | 이유 | 파일 |
|------|------|------|
| `/files` | 이름·작업 버튼이 한 줄 표. 크기·날짜만 숨김 | `frontend/src/views/FilesView.vue` |
| `/settings` | 재생 기기 카드의 이름 변경·통계 제외·삭제 버튼이 가로로 길게 붙음 | `frontend/src/components/settings/PlaybackDevicesCard.vue` |
| `/stats` | 시간대 차트가 가로 스크롤. 기간 선택은 `w-[200px]` | `frontend/src/components/charts/HabitBarChart.vue`, `frontend/src/views/StatsView.vue` |

공통으로 `ViewHeader` 제목이 `text-3xl`이라 긴 제목은 액션 버튼과 한 줄에서 부딪힌다 (`frontend/src/components/shared/ViewHeader.vue`).

---

## 손댈 순서

1. `ImportTrackTable`을 좁은 화면에서 카드로.
2. 메타·재생목록·태그 편집 창을 전체 화면에 가깝게, 스마트 믹스 조건은 세로 스택.
3. `/files`, 설정 기기 카드, `/stats` 차트.
