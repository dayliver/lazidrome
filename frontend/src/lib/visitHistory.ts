const KEY = 'lazidrome.frequentVisits.v2'
const LEGACY_KEY = 'lazidrome.frequentVisits.v1'
const MAX = 24
/** 홈 "자주 찾은 항목" 집계 기간 — 통산 누적 방지 */
export const VISIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export type VisitKind = 'playlist' | 'album' | 'artist' | 'tag'

export interface VisitEntry {
  type: VisitKind
  id: string
  name: string
  /** 최근 7일 내 방문 시각(ms) */
  hits: number[]
  /** readFrequentVisits에서 계산 */
  count: number
  at: number
}

type StoredEntry = {
  type: VisitKind
  id: string
  name: string
  hits?: number[]
  at?: number
  count?: number
}

function pruneHits(hits: number[], now: number): number[] {
  const cutoff = now - VISIT_WINDOW_MS
  return hits.filter((t) => Number.isFinite(t) && t >= cutoff)
}

function migrateLegacyEntry(raw: { type?: string; id?: string; name?: string; hits?: number[]; at?: number; count?: number }, now: number): StoredEntry | null {
  const type = raw?.type
  if (!type || type === 'track') return null
  if (!type || raw.id == null || raw.id === '') return null
  if (!['playlist', 'album', 'artist', 'tag'].includes(type)) return null

  let hits = Array.isArray(raw.hits) ? raw.hits : []
  if (!hits.length) {
    const at = Number(raw.at) || 0
    const legacyCount = Math.max(1, Number(raw.count) || 1)
    if (at && now - at <= VISIT_WINDOW_MS) {
      hits = Array.from({ length: Math.min(legacyCount, 8) }, () => at)
    }
  }
  hits = pruneHits(hits, now)
  if (!hits.length) return null
  return {
    type: type as VisitKind,
    id: String(raw.id),
    name: typeof raw.name === 'string' ? raw.name : '',
    hits,
  }
}

function loadRawList(): StoredEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    }
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (!legacy) return []
    const parsed = JSON.parse(legacy)
    const arr = Array.isArray(parsed) ? parsed : []
    try {
      localStorage.removeItem(LEGACY_KEY)
    } catch {
      /* ignore */
    }
    return arr
  } catch {
    return []
  }
}

function saveList(list: StoredEntry[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* quota */
  }
}

export function recordVisit(entry: { type: VisitKind; id: string | number; name?: string }): void {
  if (typeof localStorage === 'undefined') return
  const type = entry?.type
  const id = entry?.id
  if (!type || id == null || id === '') return
  const sid = String(id)
  const name = typeof entry.name === 'string' ? entry.name : ''

  const now = Date.now()
  let list = loadRawList()

  const idx = list.findIndex((e) => e && e.type === type && String(e.id) === sid)
  if (idx >= 0) {
    const cur = list[idx]
    const hits = pruneHits([...(Array.isArray(cur.hits) ? cur.hits : []), now], now)
    if (!hits.length) {
      list.splice(idx, 1)
    } else {
      list[idx] = { type, id: sid, name: name || cur.name || '', hits }
    }
  } else {
    list.unshift({ type, id: sid, name, hits: [now] })
  }

  list.sort((a, b) => {
    const ca = (a.hits?.length ?? 0)
    const cb = (b.hits?.length ?? 0)
    if (cb !== ca) return cb - ca
    const la = Math.max(0, ...(a.hits ?? []))
    const lb = Math.max(0, ...(b.hits ?? []))
    return lb - la
  })
  if (list.length > MAX) list = list.slice(0, MAX)

  saveList(list)
}

export function readFrequentVisits(): VisitEntry[] {
  if (typeof localStorage === 'undefined') return []
  const now = Date.now()
  try {
    const rawList = loadRawList()
    const out: VisitEntry[] = []
    for (const raw of rawList) {
      const norm = migrateLegacyEntry(raw as { type?: string; id?: string; name?: string; hits?: number[]; at?: number; count?: number }, now)
      if (!norm?.hits?.length) continue
      const hits = pruneHits(norm.hits, now)
      if (!hits.length) continue
      out.push({
        type: norm.type,
        id: norm.id,
        name: norm.name,
        hits,
        count: hits.length,
        at: Math.max(...hits),
      })
    }
    out.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return b.at - a.at
    })
    return out.slice(0, MAX)
  } catch {
    return []
  }
}
