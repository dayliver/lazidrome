export const TRACK_SORT_KEYS = new Set([
  'title',
  'artist',
  'album',
  'year',
  'duration',
  'rating',
  'play_count',
  'last_played',
  'scanned_at',
]);

const SORT_SQL = {
  title: 't.title COLLATE NOCASE',
  artist: 'MIN(a.name) COLLATE NOCASE',
  album: 'MIN(alb.name) COLLATE NOCASE',
  year: 't.year',
  duration: 'f.duration',
  rating: 't.rating',
  play_count: 't.play_count',
  last_played: 't.last_played',
  scanned_at: 'f.scanned_at',
};

const DEFAULT_SORT = [{ key: 'scanned_at', order: 'desc' }];

/** @param {Record<string, unknown>} query */
export function parseTrackListSorts(query = {}) {
  const raw = query.sorts;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = raw
      .split(',')
      .map((part) => {
        const [key, order] = part.split(':').map((s) => s.trim());
        if (!TRACK_SORT_KEYS.has(key)) return null;
        return { key, order: order === 'desc' ? 'desc' : 'asc' };
      })
      .filter(Boolean);
    if (parsed.length) return parsed;
  }

  const legacySort = String(query.sort ?? '').trim();
  if (legacySort && TRACK_SORT_KEYS.has(legacySort)) {
    return [{ key: legacySort, order: query.order === 'asc' ? 'asc' : 'desc' }];
  }

  return DEFAULT_SORT;
}

/** @param {Record<string, unknown>} query */
export function parseTrackListFilters(query = {}) {
  const sorts = parseTrackListSorts(query);

  const q = typeof query.q === 'string' ? query.q.trim() : '';
  const starred = query.starred === '1' || query.starred === 'true' || query.starred === true;

  const minRatingParsed = parseInt(String(query.minRating ?? ''), 10);
  const minRating =
    Number.isFinite(minRatingParsed) && minRatingParsed >= 1 && minRatingParsed <= 5
      ? minRatingParsed
      : null;

  const genre = typeof query.genre === 'string' ? query.genre.trim() : '';
  const artistId = typeof query.artistId === 'string' ? query.artistId.trim() : '';
  const albumId = typeof query.albumId === 'string' ? query.albumId.trim() : '';

  return {
    sorts,
    q,
    starred,
    minRating,
    genre: genre || null,
    artistId: artistId || null,
    albumId: albumId || null,
  };
}

/** @param {ReturnType<typeof parseTrackListFilters>} filters */
export function buildTrackListWhere(filters) {
  const conditions = [];
  const params = [];

  if (filters.q) {
    const pattern = `%${filters.q}%`;
    conditions.push(`(
      t.title LIKE ? COLLATE NOCASE
      OR EXISTS (
        SELECT 1 FROM track_artists ta2
        JOIN artists a2 ON a2.id = ta2.artist_id
        WHERE ta2.track_id = t.id AND a2.name LIKE ? COLLATE NOCASE
      )
      OR EXISTS (
        SELECT 1 FROM album_tracks at3
        JOIN albums al3 ON al3.id = at3.album_id
        WHERE at3.track_id = t.id AND at3.is_primary = 1 AND al3.name LIKE ? COLLATE NOCASE
      )
    )`);
    params.push(pattern, pattern, pattern);
  }

  if (filters.starred) {
    conditions.push('t.starred = 1');
  }

  if (filters.minRating != null) {
    conditions.push('t.rating >= ?');
    params.push(filters.minRating);
  }

  if (filters.genre) {
    conditions.push('t.genre LIKE ? COLLATE NOCASE');
    params.push(`%${filters.genre}%`);
  }

  if (filters.artistId) {
    conditions.push(`
      EXISTS (
        SELECT 1 FROM track_artists ta_scope
        WHERE ta_scope.track_id = t.id AND ta_scope.artist_id = ?
      )
    `);
    params.push(filters.artistId);
  }

  if (filters.albumId) {
    conditions.push(`
      EXISTS (
        SELECT 1 FROM album_tracks at_scope
        WHERE at_scope.track_id = t.id AND at_scope.album_id = ?
      )
    `);
    params.push(filters.albumId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

/** @param {Array<{ key: string, order: string }>} sorts */
export function buildTrackListOrder(sorts) {
  const list = Array.isArray(sorts) && sorts.length ? sorts : DEFAULT_SORT;
  const parts = list.map((s) => {
    const col = SORT_SQL[s.key] || SORT_SQL.scanned_at;
    const dir = s.order === 'asc' ? 'ASC' : 'DESC';
    return `${col} ${dir}`;
  });
  parts.push('t.title COLLATE NOCASE ASC');
  return `ORDER BY ${parts.join(', ')}`;
}
