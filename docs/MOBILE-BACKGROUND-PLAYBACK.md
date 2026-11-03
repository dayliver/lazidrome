# 모바일 백그라운드 재생 (HLS 큐)

## 문제

Lazidrome은 기본적으로 HTML `<audio>` + 곡마다 `/api/stream/:id` URL 교체 방식입니다.  
안드로이드에서 **화면이 꺼지면** JS가 throttling 되어 `ended` → 다음 곡 `play()`가 실패하는 경우가 많습니다.

프론트·백엔드의 재시도·프리로드만으로는 **완전 해결되지 않습니다** (OS/브라우저 정책).

## YouTube(Brave 웹 포함) 연속 재생 벤치마크

유튜브가 **앱이 아닌 Brave 웹**에서도 화면 꺼짐·앱 전환 후 소리가 이어지는 이유는
“백그라운드에서 다음 곡 `play()`를 잘해서”가 아니라, **미디어 엘리먼트가 거의 끝나지 않기** 때문이다.

### 핵심 원리 (웹)

| 원리 | YouTube / YouTube Music 웹 | Lazidrome 현황 |
|------|---------------------------|----------------|
| 단일 미디어 세션 | 하나의 `<video>`/`<audio>` + **MSE SourceBuffer**에 세그먼트를 계속 append | Android: `continuous.mp3`(ffmpeg concat)이 가장 가까움. 그 외는 곡마다 `src` 교체 또는 HLS/MSE |
| 곡/세그먼트 경계 | 논리 트랙이 바뀌어도 **네이티브 디코더가 멈추지 않음** — JS는 UI·메타만 갱신 | continuous/HLS 슬라이스 **안**에서는 OK. 슬라이스 끝·폴백 시 `ended` → 새 URL → `play()` 필요 |
| 백그라운드 JS | 오디오가 **재생 중**이면 Chrome이 탭을 덜 죽임. MSE append/네트워크가 이어짐 | 미디어가 한 번 멈추면 JS throttling → `ended` 핸들러의 async/`play()` 실패 |
| Autoplay 토큰 | `ended` 후 새 `play()`를 거의 안 탐 (버퍼가 이미 이어짐) | per-track / 슬라이스 재시작은 **새 `play()`** → 비가시 상태에서 거부·무시되기 쉬움 |
| MediaSession | 메타데이터는 바꾸되 **세션/포커스를 끊지 않음** | 백그라운드 artwork/metadata 갱신이 무음 진행을 유발해, 이미 갱신을 억제 중 |
| 네이티브 앱 | Foreground service + ExoPlayer (웹과 별개) | Capacitor 셸만 — 아직 WebView `<audio>` |

### 왜 “앱만 비활성”이어도 다음 곡이 끊기는가

Android Chrome/WebView는 `visibilityState === 'hidden'`이면:

1. 타이머·네트워크·워커를 강하게 줄인다.
2. `ended` 직후 **await(서명/URL) → `audio.play()`** 체인에 붙어 있던 user-gesture / media 세션 토큰이 끊긴다.
3. dual-`<audio>` handoff는 MediaSession을 orphan 시켜 “진행만 가고 소리 없음”이 난다 → **Android에서는 handoff·standby preload를 끔**.

그래서 유튜브처럼 **이미 버퍼에 다음 오디오가 들어 있는 한 세션**이 아니면, 비가시 상태에서 다음 곡 시작이 구조적으로 취약하다.

### 벤치마크에서 나온 우선순위

1. **한 세션을 끊지 않기** — continuous 슬라이스를 길게 / 끝나기 전에 다음 파이프를 붙이거나, fMP4+MSE `sequence`로 다음 곡을 **같은 SourceBuffer에 미리 append** (YouTube·raikiri 등 동일 패턴).
2. **슬라이스/`ended`에서 async 재시작 금지** — 비가시일 때 `void startContinuousPlayback()`은 실패 지점. 다음 창을 포그라운드에서 미리 열고 핸드오프하거나, 네이티브로 넘긴다.
3. **MediaSession은 playing 유지** — 경계에서 artwork/position 점프 금지 (이미 일부 적용).
4. **웹만으로는 YouTube 앱 수준 보장 불가** — Capacitor **ExoPlayer + foreground service**가 최종 보장.

### Phase A — continuous 슬라이스 선행 핸드오프 (적용됨)

`frontend/src/stores/player.js`:

| 단계 | 동작 |
|------|------|
| Prepare | 슬라이스 종료 ~45초 전, 다음 창의 continuous URL(+타임라인) 또는 마지막 1곡 direct URL을 `pendingContinuousSlice`에 준비 |
| Warm | **direct만** standby `load()` (continuous GET은 ffmpeg 슬롯을 쓰므로 URL만 보관) |
| Commit | `ended` / 비가시+잔여≤2.5s / 잔여≤0.4s 백업에서 **await 없이** `audio.src` 교체 + `play()` |
| Wake | `visibility` 복귀 시 슬라이스가 끝났거나 거의 끝났으면 pending commit 재시도 |

다음: **Phase B** fMP4+MSE `sequence` append, **Phase C** native ExoPlayer + foreground service.

Lazidrome 1차 대응은 **트랜스코딩 없이** 기존 파일을 HLS VOD 플레이리스트(`m3u8`)로 묶는 것이었고,
Android는 이어서 **서버 concat MP3(`continuous.mp3`)** 로 “한 src”에 더 가깝게 맞추고 있다.
둘 다 YouTube식 **단일 세션** 방향이지만, **슬라이스 경계·폴백 per-track**에서 다시 끊긴다. Phase A는 그 경계의 async 재시작을 줄인다.

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

### hls.js 로딩 (CDN + light 폴백)

| 단계 | 동작 |
|------|------|
| 1 | 모바일에서 **재생 시작** 시 `hls.min.js`를 jsDelivr CDN에서 로드 (풀 빌드, 워커 포함) |
| 2 | CDN 실패 시 sonner 경고 + 패키지 `hls.js/light` 동적 import 폴백 |
| 3 | PWA precache에서 `hls*.js` 제외 — 배포 번들에 풀 hls(~500KB)를 넣지 않음 |

- 핀 버전: `frontend/src/lib/queueHlsPlayer.js`의 `HLS_JS_VERSION` (= package.json `hls.js`)
- light는 기능 축소본(~330KB chunk)이라 오프라인·CDN 차단 시에만 쓰임

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
| 유튜브 앱 수준 | Capacitor 셸만으로는 부족 — **native media + foreground service** 필요 |

### 향후 단계

1. ~~CDN / hls.light 로딩~~ — 위 절 참고
2. ~~Capacitor Android 셸~~ — `frontend/android/`, `npm run android:sync` (여전히 WebView `<audio>`)
3. ~~Phase A: continuous 슬라이스 선행 핸드오프~~ — 위 절 참고
4. **다음 (Phase B):** fMP4 + MSE `sequence`로 다음 곡을 같은 SourceBuffer에 append
5. **Phase C:** Capacitor native plugin — ExoPlayer + foreground service + MediaSession
6. PWA + 배터리 최적화 제외 안내 UI

## 관련 파일

| 경로 | 역할 |
|------|------|
| `backend/src/lib/hlsPlaylist.js` | m3u8 생성 |
| `backend/src/handlers/stream.playlist.get.js` | 플레이리스트 API |
| `frontend/src/lib/queueHlsPlayer.js` | hls.js / 네이티브 HLS 래퍼 |
| `frontend/src/stores/player.js` | HLS 모드 분기 |
| `frontend/capacitor.config.ts` | Capacitor app id / Android scheme |
| `frontend/android/` | Native Android project |
