/**
 * Trailing parenthetical segments (e.g. deluxe editions, remasters).
 * Returns visible suffix without parentheses — same rule as the full player track title.
 */
export function splitTrailingParentheticals(raw) {
  const s = String(raw ?? '')
  const m = s.match(/^(.*?)(\s*(\([^)]*\)\s*)+)$/)
  if (!m) return { main: s, suffix: '' }
  const suffix = (m[2] || '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return {
    main: m[1].trimEnd() || s,
    suffix,
  }
}
