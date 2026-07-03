# Lazidrome 배포 (lazidrome.hwaryong.com)

## 한 줄 배포

```bash
npm run deploy
```

다음을 **순서대로** 실행합니다.

1. `build-info.json` 생성 + 프론트 빌드  
2. 원격 백엔드 **정지** (5294 포트)  
3. `rsync` — `frontend/dist`, `backend/` (`.env`·`node_modules` 제외)  
4. 원격 `npm install` + 백엔드 **재기동** + `/api` 헬스 확인  

재기동만 다시 할 때:

```bash
npm run deploy:restart
```

## 구조

| 구성 | 경로·포트 |
|------|-----------|
| 정적 프론트 | nginx → `/projects/lazidrome/frontend/dist` |
| API | nginx `location /api/` → `http://127.0.0.1:5294` |
| 백엔드 소스 | `/projects/lazidrome/backend` |

nginx SPA 설정 시 **`/assets/`는 반드시 404**로 두세요. 없는 JS에 `index.html`을 내려주면(200 + `text/html`) 배포 직후 lazy route가 깨지고 Cloudflare가 잘못된 응답을 캐시할 수 있습니다.

```nginx
location /assets/ {
  try_files $uri =404;
  add_header Cache-Control "public, max-age=31536000, immutable";
}

location / {
  try_files $uri $uri/ /index.html;
}
```

환경 변수(선택):

| 변수 | 기본값 |
|------|--------|
| `LAZI_REMOTE` | `home` (ssh 호스트) |
| `LAZI_REMOTE_DIR` | `/projects/lazidrome/backend` |

## 배포 후 확인

- 브라우저: https://lazidrome.hwaryong.com  
- **Settings → 배포 · 버전** — 프론트·백엔드 빌드 시각 일치 여부  
- 선택: `npm run smoke:phase1:prod` ([`docs/PHASE1_SMOKE.md`](PHASE1_SMOKE.md))

## lazy route / MIME type 오류

배포 직후 `Failed to load module script … MIME type "text/html"` 이 `/albums` 등에서 나오면:

1. 브라우저가 **이전 빌드 JS**(`AlbumsView-*.js` 등)를 요청하는데, 서버에는 **새 해시 파일만** 있음  
2. nginx가 없는 `/assets/*.js`에 **`index.html`을 200으로 반환** → 브라우저가 HTML을 JS로 파싱하려다 실패  
3. PWA·Cloudflare가 그 잘못된 응답을 캐시하면 같은 URL이 한동안 계속 깨짐  

**즉시 복구:** 강력 새로고침(Ctrl+Shift+R) 또는 사이트 데이터 삭제. Cloudflare 사용 시 `/assets/*` 캐시 퍼지.

**재발 방지:** 위 nginx `/assets/` 블록, 프론트의 stale chunk 자동 reload(`main.ts`), 배포 후 `npm run deploy`로 dist 전체 동기화.

## 502 Bad Gateway

원본(5294)에 백엔드가 없을 때 발생합니다.

```bash
ssh home 'curl -s http://127.0.0.1:5294/api; tail -20 /tmp/lazidrome-backend.log'
```

대부분 `npm run deploy` 한 번으로 해결됩니다.

## 서버 `.env` 체크리스트

```env
JWT_SECRET=...               # 16자 이상 (production)
ADMIN_PASSWORD=...
CORS_ORIGINS=https://lazidrome.hwaryong.com
TRACKS_PATH=...
IMAGES_PATH=...
PORT=5294
```

## 장기 운영

재부팅 후 자동 기동이 필요하면 pm2/systemd 도입을 권장합니다 (`backend/README.md`).
