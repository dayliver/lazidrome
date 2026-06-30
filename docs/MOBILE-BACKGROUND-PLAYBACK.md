# 모바일 백그라운드 재생 (HLS 큐)

## 문제

Lazidrome은 기본적으로 HTML `<audio>` + 곡마다 `/api/stream/:id` URL 교체 방식입니다.  
안드로이드에서 **화면이 꺼지면** JS가 throttling 되어 `ended` → 다음 곡 `play()`가 실패하는 경우가 많습니다.

프론트·백엔드의 재시도·프리로드만으로는 **완전 해결되지 않습니다** (OS/브라우저 정책).

## YouTube 등에서 배울 점

| 방식 | 설명 |
|------|------|
| 네이티브 앱 | Foreground service + 전용 플레이어 (웹과 다름) |
| HLS/DASH 파이프라인 | **한 미디어 세션** 안에서 세그먼트만 교체 |
| Media Session | 잠금 화면·이어폰 버튼 경로 |

Lazidrome 1차 대응은 **트랜스코딩 없이** 기존 파일을 HLS VOD 플레이리스트(`m3u8`)로 묶는 것입니다.

## 구현 개요

```
클라이언트                         서버
   │  GET /api/stream/playlist.m3u8?ids=...  (JWT)
   │ ─────────────────────────────────────► │
   │ ◄──────── application/vnd.apple.mpegurl
   │         (#EXTINF + 서명된 /api/stream/:id URL)
   │
   ├─ iOS Safari: audio.src = m3u8 (네이티브 HLS)
   └─ Android 등: hls.js + MSE (지원 시)
```

### API

`GET /api/stream/playlist.m3u8`

| 쿼리 | 설명 |
|------|------|
| `ids` | 쉼표로 구분한 track id (최대 48곡) |
| `start` | 큐 내 시작 오프셋 (메타데이터용, 기본 0) |

- **인증:** JWT (`Authorization` 헤더). hls.js는 `xhrSetup`으로 전달.
- **응답:** 각 곡은 `#EXTINF:{duration}` + 서명된 절대 스트림 URL.
- 플레이리스트 내 세그먼트 URL에는 `exp`/`sig`가 포함되어 별도 헤더 불필요.

### 클라이언트 활성 조건

다음을 **모두** 만족할 때 HLS 큐 모드:

- 모바일 UA (Android / iPhone / iPad)
- 대기열 2곡 이상
- 셔플 OFF, 반복 `one` 아님
- 네이티브 HLS 또는 hls.js 지원

그 외는 기존 단일 스트림 방식(폴백).

### 한계

| 항목 | 상태 |
|------|------|
| iOS Safari 네이티브 HLS | MP3/FLAC 등 포맷·버전에 따라 갭/메타데이터 차이 가능 |
| Android + hls.js + MP3 | MSE demux 지원 여부에 따라 **폴백** |
| 셔플 / 반복 한 곡 | HLS 큐 미사용 (플레이리스트 재생성 비용) |
| 완전한 갭리스 | 트랜스코딩·세그먼트 파이프 없이는 보장 불가 |
| 유튜브 앱 수준 | 네이티브 앱(Capacitor 등) 없이는 어려움 |

### 향후 단계

1. Android 안정화: AAC fMP4 세그먼트(온디맨드 트랜스코드) 검토
2. PWA + 배터리 최적화 제외 안내 UI
3. Capacitor + foreground service

## 관련 파일

| 경로 | 역할 |
|------|------|
| `backend/src/lib/hlsPlaylist.js` | m3u8 생성 |
| `backend/src/handlers/stream.playlist.get.js` | 플레이리스트 API |
| `frontend/src/lib/queueHlsPlayer.js` | hls.js / 네이티브 HLS 래퍼 |
| `frontend/src/stores/player.js` | HLS 모드 분기 |
