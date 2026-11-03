#!/usr/bin/env bash
# Lazidrome 원클릭 배포: 빌드 → 원격 정지 → rsync → 원격 기동
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REMOTE="${LAZI_REMOTE:-home}"
BACKEND_DIR="${LAZI_REMOTE_DIR:-/projects/lazidrome/backend}"

echo ""
echo "═══════════════════════════════════════"
echo "  Lazidrome deploy → ${REMOTE}"
echo "═══════════════════════════════════════"
echo ""

echo "▶ 1/3  build-info + frontend build"
npm run build

echo ""
echo "▶ 2/3  rsync (frontend dist + backend)"
# Keep the live PM2 process up during sync; step 3 restarts it cleanly.
npm run sync

echo ""
echo "▶ 3/3  원격 백엔드 설치·재기동 (pm2)"
bash "${ROOT}/scripts/restart-backend-remote.sh"

echo ""
echo "═══════════════════════════════════════"
echo "  ✔ deploy 완료"
echo "  · https://lazidrome.hwaryong.com"
echo "  · Settings → 배포 · 버전 에서 시각 확인"
echo "  · 선택: npm run smoke:phase1:prod"
echo "═══════════════════════════════════════"
echo ""
