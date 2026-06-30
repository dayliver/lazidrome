const STORAGE_PREFIX = 'lazidrome.mixSnapshot.'
const SNAPSHOT_VERSION = 1

function storageKey(playlistId) {
  return `${STORAGE_PREFIX}${playlistId}`
}

function clampLimit(raw) {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return 50
  return Math.min(200, n)
}

/** rules JSON → stable string for snapshot invalidation */
export function hashMixRules(rules) {
  if (!rules || typeof rules !== 'object') return ''
  const conditions = (rules.conditions || [])
    .map((c) => ({
      field: String(c.field ?? ''),
      operator: String(c.operator ?? ''),
      value: c.value,
    }))
    .filter((c) => c.field && c.value !== undefined && c.value !== null && c.value !== '')
    .sort((a, b) =>
      `${a.field}:${a.operator}:${a.value}`.localeCompare(`${b.field}:${b.operator}:${b.value}`),
    )

  return JSON.stringify({
    match: rules.match === 'any' ? 'any' : 'all',
    sortBy: String(rules.sortBy ?? 'random'),
    limit: clampLimit(rules.limit),
    conditions,
  })
}

export function loadMixSnapshot(playlistId) {
  if (!playlistId || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(storageKey(playlistId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      !parsed ||
      parsed.v !== SNAPSHOT_VERSION ||
      parsed.playlistId !== playlistId ||
      !Array.isArray(parsed.trackIds) ||
      !parsed.trackIds.length ||
      !parsed.createdAt
    ) {
      return null
    }
    return {
      playlistId,
      createdAt: String(parsed.createdAt),
      rulesHash: String(parsed.rulesHash ?? ''),
      trackIds: parsed.trackIds.map(String),
    }
  } catch {
    return null
  }
}

export function saveMixSnapshot(playlistId, { rulesHash, trackIds }) {
  if (!playlistId || typeof localStorage === 'undefined') return false
  const ids = [...new Set((trackIds || []).map(String).filter(Boolean))]
  if (!ids.length) return false
  try {
    localStorage.setItem(
      storageKey(playlistId),
      JSON.stringify({
        v: SNAPSHOT_VERSION,
        playlistId,
        createdAt: new Date().toISOString(),
        rulesHash: String(rulesHash ?? ''),
        trackIds: ids,
      }),
    )
    return true
  } catch {
    return false
  }
}

export function removeMixSnapshot(playlistId) {
  if (!playlistId || typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(storageKey(playlistId))
  } catch {
    /* ignore */
  }
}

export function isMixSnapshotValid(snapshot, rulesHash) {
  return Boolean(snapshot?.trackIds?.length && snapshot.rulesHash === rulesHash)
}
