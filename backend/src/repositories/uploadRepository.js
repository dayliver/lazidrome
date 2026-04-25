import { getDB } from '../db.js';

export function insertUploadedTrackTransaction(payload) {
  const db = getDB();
  const { fileHash, filePath, fileSize, duration, bitrate, format, trackId, title } = payload;

  db.transaction(() => {
    // 1. 물리 파일 정보 저장
    db.prepare(`
      INSERT INTO track_filedata (id, path, size, duration, bitrate, format, source)
      VALUES (?, ?, ?, ?, ?, ?, 'upload')
    `).run(fileHash, filePath, fileSize, duration, bitrate, format);

    // 2. 메타데이터 (곡 정보) 저장
    db.prepare(`
      INSERT INTO track_metadata (id, file_id, title, duration)
      VALUES (?, ?, ?, ?)
    `).run(trackId, fileHash, title, duration);
  })();
}