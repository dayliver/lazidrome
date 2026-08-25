import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mergeDuplicateArtistsByName } from './lib/artistDedup.js';

// ES Module에서 __dirname 사용을 위한 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 경로 설정
const DB_PATH = path.join(__dirname, '../database/lazidrome.db');
const SCHEMA_PATH = path.join(__dirname, '../database/schema.sql');

// 데이터베이스 연결
const db = new Database(DB_PATH);

/**
 * 💉 추가된 함수: 외부에서 DB 인스턴스에 접근할 때 사용합니다.
 */
export function getDB() {
  return db;
}

/**
 * DB 초기화 함수: 테이블이 없으면 schema.sql을 실행합니다.
 */
export function initDB() {
  // SQLite 성능 최적화 설정 (N100의 부담을 덜어줍니다)
  db.pragma('journal_mode = WAL'); 
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON'); 

  // 테이블 존재 여부 확인
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='track_filedata'"
  ).get();

  if (!tableExists) {
    console.log('📂 데이터베이스가 비어 있습니다. 스키마를 초기화합니다...');
    try {
      const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
      db.exec(schema);
      console.log('✅ 데이터베이스 초기화 완료!');
    } catch (err) {
      console.error('❌ 스키마 초기화 중 오류 발생:', err);
      process.exit(1);
    }
  } else {
    console.log('✔ 데이터베이스가 이미 준비되어 있습니다.');
  }
  ensureAlbumDescriptionColumn();
  normalizeEmptyMbids();
  ensurePageVisitsTable();
  ensurePlayHistoryListenedSec();
  // 컬럼 추가는 인덱스 생성보다 먼저 — ensurePerformanceIndexes가 device_id를 참조한다
  ensurePlaybackDevices();
  ensurePerformanceIndexes();
  ensureTrackFiledataMtime();
  ensureTrackVolumePct();
  ensureUniqueArtistNames();
}

/** track_filedata.mtime_ms: 스캐너 변경 감지용 (기존 DB 마이그레이션) */
function ensureTrackFiledataMtime() {
  const cols = db.prepare('PRAGMA table_info(track_filedata)').all();
  if (cols.some((c) => c.name === 'mtime_ms')) return;
  try {
    db.exec('ALTER TABLE track_filedata ADD COLUMN mtime_ms INTEGER');
    console.log('📌 track_filedata.mtime_ms 컬럼 추가됨 (마이그레이션)');
  } catch (err) {
    console.error('❌ track_filedata.mtime_ms 마이그레이션 실패:', err.message);
  }
}

/** track_metadata.volume_pct: 트랙 상대 음량 (100 = unity) */
function ensureTrackVolumePct() {
  const cols = db.prepare('PRAGMA table_info(track_metadata)').all();
  if (cols.some((c) => c.name === 'volume_pct')) return;
  try {
    db.exec(
      'ALTER TABLE track_metadata ADD COLUMN volume_pct INTEGER NOT NULL DEFAULT 100',
    );
    console.log('📌 track_metadata.volume_pct 컬럼 추가됨 (마이그레이션)');
  } catch (err) {
    console.error('❌ track_metadata.volume_pct 마이그레이션 실패:', err.message);
  }
}

/**
 * 재생 기기 귀속: `play_history.device_id` + `playback_devices` 레지스트리.
 * device_id는 소프트 참조라 FK를 걸지 않는다 — 기기를 지워도 과거 기록은 보존.
 * 기존 행의 device_id는 NULL(= 기기 미상)로 남는다.
 */
function ensurePlaybackDevices() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS playback_devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        exclude_from_stats INTEGER NOT NULL DEFAULT 0,
        last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('❌ playback_devices 테이블 생성 실패:', err.message);
    return;
  }

  const cols = db.prepare('PRAGMA table_info(play_history)').all();
  if (cols.some((c) => c.name === 'device_id')) return;
  try {
    db.exec('ALTER TABLE play_history ADD COLUMN device_id TEXT');
    console.log('📌 play_history.device_id 컬럼 추가됨 (마이그레이션)');
  } catch (err) {
    console.error('❌ play_history.device_id 마이그레이션 실패:', err.message);
  }
}

/** 스캐너·통계·상세 조회 hot path 인덱스 (기존 DB 마이그레이션) */
function ensurePerformanceIndexes() {
  const statements = [
    'CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name)',
    'CREATE INDEX IF NOT EXISTS idx_albums_name ON albums(name)',
    'CREATE INDEX IF NOT EXISTS idx_track_metadata_file ON track_metadata(file_id)',
    'CREATE INDEX IF NOT EXISTS idx_history_track_time ON play_history(track_id, played_at)',
    'CREATE INDEX IF NOT EXISTS idx_history_device_time ON play_history(device_id, played_at)',
    'CREATE INDEX IF NOT EXISTS idx_album_tracks_album ON album_tracks(album_id)',
    'CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, position)',
    'CREATE INDEX IF NOT EXISTS idx_track_artists_artist ON track_artists(artist_id)',
  ];
  try {
    for (const sql of statements) db.exec(sql);
  } catch (err) {
    console.error('❌ 성능 인덱스 마이그레이션 실패:', err.message);
  }
}

/** 동일 이름 아티스트 병합 후 UNIQUE(name COLLATE NOCASE) — 0트랙 고스트 아티스트 재발 방지 */
function ensureUniqueArtistNames() {
  try {
    const merged = mergeDuplicateArtistsByName();
    if (merged) console.log(`📌 중복 아티스트 병합: ${merged}건 제거`);
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_name_unique ON artists(name COLLATE NOCASE)',
    );
  } catch (err) {
    console.error('❌ 아티스트 이름 UNIQUE 마이그레이션 실패:', err.message);
  }
}

/** play_history.listened_sec: 기존 행은 지수 추정 백필, 이후 신규 행은 실측값 저장 */
const LISTEN_ESTIMATE_FLOOR = 0.95;
/** 30회차쯤 floor(95%)에 수렴: 0.95 + 0.05·e^(-k·29) ≈ 0.951 */
const LISTEN_ESTIMATE_DECAY_K = Math.log(50) / 29;

function estimatedListenSec(durationSec, playNumber) {
  const duration = Number(durationSec);
  const n = Math.max(1, Number(playNumber) || 1);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const completion =
    LISTEN_ESTIMATE_FLOOR + (1 - LISTEN_ESTIMATE_FLOOR) * Math.exp(-LISTEN_ESTIMATE_DECAY_K * (n - 1));
  return Math.round(duration * completion);
}

function ensurePlayHistoryListenedSec() {
  const historyExists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='play_history'")
    .get();
  if (!historyExists) return;

  const cols = db.prepare('PRAGMA table_info(play_history)').all();
  if (!cols.some((c) => c.name === 'listened_sec')) {
    try {
      db.exec('ALTER TABLE play_history ADD COLUMN listened_sec INTEGER');
      console.log('📌 play_history.listened_sec 컬럼 추가됨 (마이그레이션)');
    } catch (err) {
      console.error('❌ play_history.listened_sec 마이그레이션 실패:', err.message);
      return;
    }
  }

  try {
    const pending = db
      .prepare(
        `SELECT h.id, f.duration AS duration_sec,
                ROW_NUMBER() OVER (
                  PARTITION BY h.track_id
                  ORDER BY h.played_at ASC, h.id ASC
                ) AS play_number
         FROM play_history h
         JOIN track_metadata t ON t.id = h.track_id
         JOIN track_filedata f ON f.id = t.file_id
         WHERE h.listened_sec IS NULL`,
      )
      .all();

    if (!pending.length) return;

    const update = db.prepare(
      'UPDATE play_history SET listened_sec = ? WHERE id = ? AND listened_sec IS NULL',
    );
    const tx = db.transaction((rows) => {
      let updated = 0;
      let skipped = 0;
      for (const row of rows) {
        const listenedSec = estimatedListenSec(row.duration_sec, row.play_number);
        if (listenedSec == null) {
          skipped += 1;
          continue;
        }
        updated += update.run(listenedSec, row.id).changes;
      }
      return { updated, skipped };
    });
    const { updated, skipped } = tx(pending);
    if (updated || skipped) {
      console.log(
        `📌 play_history listened_sec 백필: ${updated}건 추정 저장` +
          (skipped ? `, ${skipped}건 duration 없음 스킵` : ''),
      );
    }
  } catch (err) {
    console.error('❌ play_history listened_sec 백필 실패:', err.message);
  }
}

/** 기존 DB에 albums.description 컬럼이 없으면 추가 (스키마 v2.1+) */
function ensureAlbumDescriptionColumn() {
  const cols = db.prepare('PRAGMA table_info(albums)').all();
  if (cols.some((c) => c.name === 'description')) return;
  try {
    db.exec('ALTER TABLE albums ADD COLUMN description TEXT');
    console.log('📌 albums.description 컬럼 추가됨 (마이그레이션)');
  } catch (err) {
    console.error('❌ albums.description 마이그레이션 실패:', err.message);
  }
}

/** 빈 mbid('')는 UNIQUE 충돌을 일으키므로 NULL로 정규화 */
function normalizeEmptyMbids() {
  try {
    const albumN = db.prepare("UPDATE albums SET mbid = NULL WHERE mbid = ''").run().changes;
    const artistN = db.prepare("UPDATE artists SET mbid = NULL WHERE mbid = ''").run().changes;
    if (albumN || artistN) {
      console.log(`📌 빈 MBID 정규화: albums ${albumN}, artists ${artistN}`);
    }
  } catch (err) {
    console.error('❌ MBID 정규화 실패:', err.message);
  }
}

/** page_visits 테이블 (기존 DB 마이그레이션) */
function ensurePageVisitsTable() {
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='page_visits'")
    .get();
  if (exists) return;
  try {
    db.exec(`
      CREATE TABLE page_visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        visited_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_page_visits_time ON page_visits(visited_at);
      CREATE INDEX idx_page_visits_entity ON page_visits(entity_type, entity_id, visited_at);
    `);
    console.log('📌 page_visits 테이블 추가됨 (마이그레이션)');
  } catch (err) {
    console.error('❌ page_visits 마이그레이션 실패:', err.message);
  }
}

export default db;