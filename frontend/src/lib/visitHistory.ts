// @ts-nocheck — Pinia auth store is JS; visit helpers call fetch at runtime only.
import { useAuthStore } from '@/stores/auth'

const LEGACY_STORAGE_KEY = 'lazidrome.frequentVisits.v2'
const LEGACY_STORAGE_KEY_V1 = 'lazidrome.frequentVisits.v1'
/** @deprecated 자동 import 마이그레이션 플래그 — 폐기 후 DB clear 트리거용 */
const OLD_IMPORTED_FLAG = 'lazidrome.frequentVisits.dbMigrated.v1'
const DISCARDED_KEY = 'lazidrome.frequentVisits.discardedLocal.v1'

/** 홈 "자주 찾은 항목" 집계 기간 — 서버와 동일 (7일) */
export const VISIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export type VisitKind = 'playlist' | 'album' | 'artist' | 'tag' | 'track'

export interface VisitEntry {
  type: VisitKind
  id: string
  name: string
  count: number
  at: number
}

function clearLocalVisitStorage(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    localStorage.removeItem(LEGACY_STORAGE_KEY_V1)
    localStorage.removeItem(OLD_IMPORTED_FLAG)
  } catch {
    /* ignore */
  }
}

/**
 * localStorage 방문 기록은 DB로 가져오지 않고 폐기합니다.
 * 예전 자동 import(dbMigrated.v1)로 DB에 들어간 데이터는 1회 DELETE합니다.
 */
export async function ensureLegacyVisitsDiscarded(): Promise<void> {
  if (typeof localStorage === 'undefined') return

  const auth = useAuthStore()
  const hadAutoImport = localStorage.getItem(OLD_IMPORTED_FLAG) === '1'
  const alreadyDiscarded = localStorage.getItem(DISCARDED_KEY) === '1'

  if (!alreadyDiscarded && auth.token && hadAutoImport) {
    try {
      const res = await auth.fetchWithAuth('/api/visits/clear', { method: 'POST' })
      if (!res.ok) return
    } catch {
      return
    }
  }

  clearLocalVisitStorage()
  if (!alreadyDiscarded) {
    localStorage.setItem(DISCARDED_KEY, '1')
  }
}

/** @deprecated ensureLegacyVisitsDiscarded 사용 */
export const ensureVisitsMigrated = ensureLegacyVisitsDiscarded

/** 상세 페이지 방문 기록 (best-effort, 서버 30초 디바운스) */
export function recordVisit(entry: { type: VisitKind; id: string | number; name?: string }): void {
  void postVisit(entry)
}

async function postVisit(entry: { type: VisitKind; id: string | number }): Promise<void> {
  const type = entry?.type
  const id = entry?.id
  if (!type || id == null || id === '') return

  const auth = useAuthStore()
  if (!auth.token) return

  try {
    await auth.fetchWithAuth('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id: String(id) }),
    })
  } catch {
    /* offline 등 — 무시 */
  }
}

/** 홈 "자주 찾은 항목" (최근 7일, 서버 집계) */
export async function fetchFrequentVisits(limit = 24): Promise<VisitEntry[]> {
  const auth = useAuthStore()
  if (!auth.token) return []

  try {
    const q = new URLSearchParams({ limit: String(limit) })
    const res = await auth.fetchWithAuth(`/api/visits/frequent?${q}`)
    if (!res.ok) return []
    const body = await res.json()
    const rows = Array.isArray(body?.data) ? body.data : []
    return rows.map((row: VisitEntry) => ({
      type: row.type,
      id: String(row.id),
      name: typeof row.name === 'string' ? row.name : '',
      count: Number(row.count) || 0,
      at: Number(row.at) || 0,
    }))
  } catch {
    return []
  }
}
