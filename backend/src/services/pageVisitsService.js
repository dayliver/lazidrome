import {
  VISIT_ENTITY_TYPES,
  VISIT_WINDOW_DAYS,
  hasRecentVisit,
  insertVisit,
  findFrequentVisits,
  bulkInsertVisits,
  clearAllVisits,
  resolveEntityDisplayName,
  entityExists,
} from '../repositories/pageVisitsRepository.js';
import { schedulePageVisitsPruneDebounced } from './pageVisitsPrune.js';

const MAX_IMPORT_EVENTS = 800;

function validateEntity(type, id) {
  if (!type || !VISIT_ENTITY_TYPES.has(type)) {
    const err = new Error('유효하지 않은 방문 유형입니다.');
    err.statusCode = 400;
    throw err;
  }
  const sid = id != null ? String(id).trim() : '';
  if (!sid) {
    const err = new Error('방문 대상 id가 필요합니다.');
    err.statusCode = 400;
    throw err;
  }
  return { type, id: sid };
}

/** @param {number} ms */
function isWithinVisitWindow(ms) {
  const now = Date.now();
  const cutoff = now - VISIT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return Number.isFinite(ms) && ms >= cutoff && ms <= now + 60_000;
}

function sqliteDatetimeFromMs(ms) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export function recordPageVisit(type, id) {
  const { type: t, id: sid } = validateEntity(type, id);
  if (!entityExists(t, sid)) {
    return { recorded: false, missing: true };
  }
  if (hasRecentVisit(t, sid)) {
    return { recorded: false, debounced: true };
  }
  insertVisit(t, sid);
  schedulePageVisitsPruneDebounced();
  return { recorded: true, debounced: false };
}

export function getFrequentVisits(limit) {
  const rows = findFrequentVisits(limit);
  return rows
    .map((row) => ({
      type: row.type,
      id: row.id,
      name: resolveEntityDisplayName(row.type, row.id),
      count: row.count,
      at: Date.parse(String(row.at).replace(' ', 'T') + 'Z') || 0,
    }))
    .filter((row) => row.type === 'tag' || (row.name && String(row.name).trim()));
}

/**
 * localStorage 마이그레이션: [{ type, id, hits: number[] }]
 */
export function importPageVisits(entries) {
  if (!Array.isArray(entries)) {
    const err = new Error('visits 배열이 필요합니다.');
    err.statusCode = 400;
    throw err;
  }

  const rows = [];
  for (const entry of entries) {
    if (!entry || !VISIT_ENTITY_TYPES.has(entry.type)) continue;
    const sid = entry.id != null ? String(entry.id).trim() : '';
    if (!sid) continue;
    const hits = Array.isArray(entry.hits) ? entry.hits : [];
    for (const raw of hits) {
      const ms = Number(raw);
      if (!isWithinVisitWindow(ms)) continue;
      const visited_at = sqliteDatetimeFromMs(ms);
      if (!visited_at) continue;
      rows.push({ entity_type: entry.type, entity_id: sid, visited_at });
      if (rows.length >= MAX_IMPORT_EVENTS) break;
    }
    if (rows.length >= MAX_IMPORT_EVENTS) break;
  }

  const inserted = bulkInsertVisits(rows);
  schedulePageVisitsPruneDebounced();
  return { inserted, capped: rows.length >= MAX_IMPORT_EVENTS };
}

export function clearAllPageVisits() {
  const deleted = clearAllVisits();
  return { deleted };
}
