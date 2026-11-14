/** Shared track list SELECT/JOIN fragments used by track, home, stats, tags repos. */

export const TRACK_LIST_FROM = `
    FROM track_metadata t
    JOIN track_filedata f ON t.file_id = f.id
    LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
    LEFT JOIN albums alb ON at.album_id = alb.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id
    LEFT JOIN artists a ON ta.artist_id = a.id`;

/** Core columns shared by list endpoints (home omits scanned_at / disc·track nos). */
export const TRACK_LIST_CORE_COLUMNS = `
      t.id, t.title, t.rating, t.starred,
      COALESCE(t.year, alb.year) AS year, t.tags, t.play_count, t.last_played,
      COALESCE(t.volume_pct, 100) AS volume_pct,
      t.custom_cover_type, f.duration, f.format, f.bitrate,
      alb.id as albumId, alb.name as albumName, alb.cover_type as albumCoverType,
      GROUP_CONCAT(a.name, ', ') as artist`;

export const TRACK_LIST_SELECT = `
    SELECT
      ${TRACK_LIST_CORE_COLUMNS.trim()},
      f.scanned_at,
      at.track_number, at.disc_number
    ${TRACK_LIST_FROM}`;

export const TRACK_LIST_SELECT_HOME = `
  SELECT
    ${TRACK_LIST_CORE_COLUMNS.trim()}
  ${TRACK_LIST_FROM}
`;

export const TRACK_LIST_FROM_ALBUM = `
    FROM track_metadata t
    JOIN track_filedata f ON t.file_id = f.id
    JOIN album_tracks at ON t.id = at.track_id AND at.album_id = ?
    LEFT JOIN albums alb ON at.album_id = alb.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id
    LEFT JOIN artists a ON ta.artist_id = a.id`;

export const TRACK_LIST_SELECT_ALBUM = `
    SELECT
      ${TRACK_LIST_CORE_COLUMNS.trim()},
      f.scanned_at,
      at.track_number, at.disc_number
    ${TRACK_LIST_FROM_ALBUM}`;

export const ARTISTS_JSON_SUBQUERY = `(SELECT json_group_array(json_object('id', a.id, 'name', a.name, 'role_mask', ta.role_mask))
        FROM track_artists ta JOIN artists a ON ta.artist_id = a.id WHERE ta.track_id = t.id)`;

/** Names-only artists blob (playlists / scrobble helpers). */
export const ARTISTS_JSON_NAMES_SUBQUERY = `(SELECT json_group_array(json_object('id', a.id, 'name', a.name))
        FROM track_artists ta JOIN artists a ON ta.artist_id = a.id WHERE ta.track_id = t.id)`;
