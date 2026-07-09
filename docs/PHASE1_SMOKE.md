# Phase 1 프로덕션 스모크

배포 후 **인증·CORS·exp/sig 미디어**가 프로덕션에서 동작하는지 확인합니다.

## 빠른 실행

```bash
# 로컬 백엔드 (backend/.env 비밀번호 사용)
npm run smoke:phase1

# 프로덕션 HTTPS (비밀번호는 서버와 동일해야 함)
npm run smoke:phase1:prod

# 서버에서 (비밀번호·CORS preflight까지)
ssh home 'PW=$(grep "^ADMIN_PASSWORD=" /projects/lazidrome/backend/.env | sed "s/^ADMIN_PASSWORD=//" | sed "s/[[:space:]]*#.*//" | tr -d "\r") && \
  LAZI_BASE_URL=https://lazidrome.hwaryong.com \
  LAZI_ORIGIN=https://lazidrome.hwaryong.com \
  LAZI_CORS_DIRECT=http://127.0.0.1:5294 \
  LAZI_ADMIN_PASSWORD="$PW" node /tmp/smoke-phase1.mjs'
```

(`scripts/smoke-phase1.mjs`는 배포 전 `scp`로 서버에 복사하거나, 저장소 경로에서 실행)

## 체크 항목

| 항목 | 기대 |
|------|------|
| `PATCH /api/tracks/:id` 무인증 | 401 |
| CORS preflight (`Origin: https://lazidrome.hwaryong.com`) | 204 + `Access-Control-Allow-Origin` |
| 외부 Origin | ACAO 없음 |
| 로그인 | 200 + JWT |
| `POST /api/auth/media-sign` | stream·image 서명 |
| `GET /api/stream/:id?exp=&sig=` | 프리뷰보다 큰 본문 |
| `GET /api/images/track/:id?exp=&sig=` | 200 또는 404(커버 없음) |
| `Cache-Control` / `ETag` (이미지·스트림) | `private, max-age=…`, `If-None-Match` → 304 |
| 레거시 `?token=` 스트림 | 200 (호환) |

## 프로덕션 참고

- **https://lazidrome.hwaryong.com** 에서 프론트와 API가 **같은 호스트**이면 브라우저는 CORS를 거의 타지 않습니다. Vite 개발(`localhost:3000`)은 `CORS_ORIGINS`에 포함해야 합니다.
- `npm run deploy`만 하면 백엔드가 자동 재시작되지 않습니다 → `npm run deploy:restart`.

## Phase 1 체크리스트

- [x] 스모크 스크립트 (`scripts/smoke-phase1.mjs`)
- [x] OPTIONS가 JWT 훅에 막히지 않도록 수정 (`index.js`)
- [x] CORS 허용 origin 반영 (`cb(null, origin)`)
