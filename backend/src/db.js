import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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