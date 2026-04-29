/**
 * Normalize ID3-style multi-value tags (string | string[] | undefined).
 */
export function normalizeTagString(raw) {
  if (raw == null || raw === '') return '';
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean).join(', ');
  return String(raw);
}

/**
 * Split artist-style strings into individual names (same rules as scanner).
 */
export function splitArtistNames(raw) {
  const s = normalizeTagString(raw).trim();
  if (!s) return [];
  return s.split(/[,/;]|\s&\s/).map((x) => x.trim()).filter(Boolean);
}
