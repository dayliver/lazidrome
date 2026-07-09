export const DEFAULT_PAGE_LIMIT = 60;
export const MAX_PAGE_LIMIT = 200;

/** @param {Record<string, unknown>} query */
export function parsePageQuery(query, { defaultLimit = DEFAULT_PAGE_LIMIT } = {}) {
  const hasLimit = query.limit !== undefined && query.limit !== '';
  const hasOffset = query.offset !== undefined && query.offset !== '';

  if (!hasLimit && !hasOffset) return null;

  const limit = Math.min(
    MAX_PAGE_LIMIT,
    Math.max(1, parseInt(String(query.limit ?? defaultLimit), 10) || defaultLimit),
  );
  const offset = Math.max(0, parseInt(String(query.offset ?? '0'), 10) || 0);

  return { limit, offset };
}

export function parseSearchQuery(query) {
  const q = query?.q;
  if (typeof q !== 'string' || !q.trim()) return '';
  return q.trim();
}
