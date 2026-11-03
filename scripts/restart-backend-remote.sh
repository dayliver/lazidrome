#!/usr/bin/env bash
# 원격 서버에서 Lazidrome 백엔드를 설치·재기동합니다.
# 보통 `npm run deploy`가 호출합니다. 재기동만: npm run deploy:restart
set -euo pipefail
REMOTE="${LAZI_REMOTE:-home}"
DIR="${LAZI_REMOTE_DIR:-/projects/lazidrome/backend}"
PM2_APP="${LAZI_PM2_APP:-lazidrome-backend}"

ssh "$REMOTE" bash -s <<EOF
set -euo pipefail
cd "$DIR"
echo "→ npm install (production deps)…"
npm install --omit=dev
if ! grep -q '^CORS_ORIGINS=.*lazidrome' .env 2>/dev/null; then
  echo "→ CORS_ORIGINS 추가 (없을 때만)"
  printf '\nCORS_ORIGINS=https://lazidrome.hwaryong.com\n' >> .env
fi

PM2=""
for cand in \\
  "\$HOME/.nvm/versions/node/v20.18.3/bin/pm2" \\
  "\$HOME/.nvm/versions/node/v20.*/bin/pm2" \\
  "\$HOME/.nvm/versions/node/*/bin/pm2" \\
  "\$(command -v pm2 2>/dev/null || true)"
do
  # shellcheck disable=SC2086
  for p in \$cand; do
    if [ -x "\$p" ]; then PM2="\$p"; break 2; fi
  done
done

echo "→ 기존 Lazidrome node 프로세스 종료…"
if [ -n "\$PM2" ] && "\$PM2" describe "$PM2_APP" >/dev/null 2>&1; then
  echo "   (pm2 restart $PM2_APP via \$PM2)"
  # Do not fuser-kill :5294 here — that races PM2 and can leave the app down.
  # Drop only stray nohup copies whose cmdline is the absolute script path without pm2.
  "\$PM2" restart "$PM2_APP" --update-env
  sleep 5
else
  echo "   (pm2 app not found — falling back to nohup with /usr/local/bin/node)"
  pkill -f "lazidrome/backend/src/index.js" 2>/dev/null || true
  fuser -k 5294/tcp 2>/dev/null || true
  sleep 2
  nohup /usr/local/bin/node "${DIR}/src/index.js" >> /tmp/lazidrome-backend.log 2>&1 &
  sleep 2
fi

if curl -sf http://127.0.0.1:5294/api >/dev/null; then
  echo "✔ API 응답 OK (http://127.0.0.1:5294/api)"
  body=\$(curl -sS 'http://127.0.0.1:5294/api/stream/continuous.mp3?ids=x' || true)
  code=\$(curl -sS -o /dev/null -w '%{http_code}' 'http://127.0.0.1:5294/api/stream/continuous.mp3?ids=x' || true)
  if echo "\$body" | grep -q 'Track or physical file'; then
    echo "✘ continuous.mp3 still captured by /api/stream/:id"
    exit 1
  fi
  echo "✔ continuous.mp3 route responds (HTTP \$code)"
  tail -1 /tmp/lazidrome-backend.log 2>/dev/null | grep -o 'CORS origins:.*' || true
else
  echo "✘ API 기동 실패 — 로그:"
  tail -20 /tmp/lazidrome-backend.log 2>/dev/null || "\$PM2" logs "$PM2_APP" --lines 20 --nostream 2>/dev/null || true
  exit 1
fi
EOF
