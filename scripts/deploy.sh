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

echo "▶ 1/4  build-info + frontend build"
npm run build

echo ""
echo "▶ 2/4  원격 백엔드 정지"
ssh "$REMOTE" bash -s <<EOF
set -euo pipefail
echo "   → node 프로세스 종료 (5294)"
pkill -f "lazidrome/backend/src/index.js" 2>/dev/null || true
pkill -f "${BACKEND_DIR}/src/index.js" 2>/dev/null || true
sleep 1
if ss -tlnp 2>/dev/null | grep -q ':5294 '; then
  echo "   ⚠ 5294 포트가 아직 사용 중입니다. 수동 확인: ss -tlnp | grep 5294"
else
  echo "   ✔ 5294 포트 비움"
fi
EOF

echo ""
echo "▶ 3/4  rsync (frontend dist + backend)"
npm run sync

echo ""
echo "▶ 4/4  원격 백엔드 설치·재기동"
bash "${ROOT}/scripts/restart-backend-remote.sh"

echo ""
echo "═══════════════════════════════════════"
echo "  ✔ deploy 완료"
echo "  · https://lazidrome.hwaryong.com"
echo "  · Settings → 배포 · 버전 에서 시각 확인"
echo "  · 선택: npm run smoke:phase1:prod"
echo "═══════════════════════════════════════"
echo ""
