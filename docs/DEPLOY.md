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

환경 변수(선택):

| 변수 | 기본값 |
|------|--------|
| `LAZI_REMOTE` | `home` (ssh 호스트) |
| `LAZI_REMOTE_DIR` | `/projects/lazidrome/backend` |

## 배포 후 확인

- 브라우저: https://lazidrome.hwaryong.com  
- **Settings → 배포 · 버전** — 프론트·백엔드 빌드 시각 일치 여부  
- 선택: `npm run smoke:phase1:prod` ([`docs/PHASE1_SMOKE.md`](PHASE1_SMOKE.md))

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
