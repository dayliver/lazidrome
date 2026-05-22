#!/usr/bin/env bash
# 원격 서버에서 Lazidrome 백엔드를 설치·재기동합니다.
# 보통 `npm run deploy`가 호출합니다. 재기동만: npm run deploy:restart
set -euo pipefail
REMOTE="${LAZI_REMOTE:-home}"
DIR="${LAZI_REMOTE_DIR:-/projects/lazidrome/backend}"

ssh "$REMOTE" bash -s <<EOF
set -euo pipefail
cd "$DIR"
echo "→ npm install (production deps)…"
npm install --omit=dev
if ! grep -q '^CORS_ORIGINS=.*lazidrome' .env 2>/dev/null; then
  echo "→ CORS_ORIGINS 추가 (없을 때만)"
  printf '\nCORS_ORIGINS=https://lazidrome.hwaryong.com\n' >> .env
fi
echo "→ 기존 Lazidrome node 프로세스 종료…"
pkill -f "lazidrome/backend/src/index.js" 2>/dev/null || true
pkill -f "${DIR}/src/index.js" 2>/dev/null || true
sleep 1
echo "→ 백엔드 기동…"
nohup node src/index.js >> /tmp/lazidrome-backend.log 2>&1 &
sleep 2
if curl -sf http://127.0.0.1:5294/api >/dev/null; then
  echo "✔ API 응답 OK (http://127.0.0.1:5294/api)"
  tail -1 /tmp/lazidrome-backend.log | grep -o 'CORS origins:.*' || true
else
  echo "✘ API 기동 실패 — 로그:"
  tail -20 /tmp/lazidrome-backend.log
  exit 1
fi
EOF
