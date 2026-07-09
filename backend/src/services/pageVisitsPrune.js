import { pruneOldVisits, pruneOrphanVisits } from '../repositories/pageVisitsRepository.js';

/** 오래된·고아 visit 행 정리 주기 (ms) */
const PRUNE_INTERVAL_MS = 10 * 60 * 1000;

/** visit 기록 직후 debounce (ms) — 연속 방문 시 DELETE 폭주 방지 */
const PRUNE_DEBOUNCE_MS = 60 * 1000;

let intervalTimer = null;
let debounceTimer = null;

export function runPageVisitsPrune() {
  pruneOldVisits();
  pruneOrphanVisits();
}

export function schedulePageVisitsPruneDebounced(delayMs = PRUNE_DEBOUNCE_MS) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    runPageVisitsPrune();
  }, delayMs);
}

/** 기동 시 1회 + 주기 배치. hot path(조회)에서는 호출하지 않는다. */
export function startPageVisitsPruneScheduler() {
  if (intervalTimer) return;
  runPageVisitsPrune();
  intervalTimer = setInterval(runPageVisitsPrune, PRUNE_INTERVAL_MS);
  intervalTimer.unref?.();
}
