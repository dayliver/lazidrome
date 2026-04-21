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
}

export default db;