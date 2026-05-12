const KEY = 'lazidrome.frequentVisits.v1'
const MAX = 24

export type VisitKind = 'playlist' | 'album' | 'artist' | 'track' | 'tag'

export interface VisitEntry {
  type: VisitKind
  id: string
  name: string
  at: number
  count: number
}

export function recordVisit(entry: { type: VisitKind; id: string | number; name?: string }): void {
  if (typeof localStorage === 'undefined') return
  const type = entry?.type
  const id = entry?.id
  if (!type || id == null || id === '') return
  const sid = String(id)
  const name = typeof entry.name === 'string' ? entry.name : ''

  let list: VisitEntry[] = []
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    list = Array.isArray(parsed) ? (parsed as VisitEntry[]) : []
  } catch {
    list = []
  }

  const now = Date.now()
  const idx = list.findIndex((e) => e && e.type === type && String(e.id) === sid)
  if (idx >= 0) {
    const cur = list[idx]
    cur.count = (Number(cur.count) || 0) + 1
    cur.at = now
    if (name) cur.name = name
  } else {
    list.unshift({ type, id: sid, name, at: now, count: 1 })
  }

  list.sort((a, b) => {
    const dc = (Number(b.count) || 0) - (Number(a.count) || 0)
    if (dc !== 0) return dc
    return (Number(b.at) || 0) - (Number(a.at) || 0)
  })
  if (list.length > MAX) list = list.slice(0, MAX)

  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* quota */
  }
}

export function readFrequentVisits(): VisitEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return (parsed as VisitEntry[]).filter((e) => e && e.type && e.id != null)
  } catch {
    return []
  }
}
