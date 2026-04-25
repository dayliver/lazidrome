import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';
import * as mm from 'music-metadata';
import { ulid } from 'ulid';
import { insertUploadedTrackTransaction } from '../repositories/uploadRepository.js';

const TRACKS_PATH = process.env.TRACKS_PATH || './storage/tracks';

export async function processAudioUpload(fileData) {
  // 1. 디렉토리 준비
  if (!fs.existsSync(TRACKS_PATH)) {
    fs.mkdirSync(TRACKS_PATH, { recursive: true });
  }

  const tempId = ulid();
  const ext = path.extname(fileData.filename);
  const fileName = `${tempId}${ext}`;
  const filePath = path.join(TRACKS_PATH, fileName);

  try {
    // 2. 파일 스트림 저장 (메모리 누수 방지)
    await pipeline(fileData.file, fs.createWriteStream(filePath));

    // 3. 메타데이터 및 해시 추출
    const metadata = await mm.parseFile(filePath);
    const fileBuffer = fs.readFileSync(filePath);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 4. DB 저장용 데이터 정제
    const title = metadata.common.title || fileData.filename.replace(ext, '');
    const duration = metadata.format.duration || 0;
    const bitrate = Math.round((metadata.format.bitrate || 0) / 1000);
    const format = metadata.format.container || ext.replace('.', '');
    const trackId = ulid();

    // 5. DB 트랜잭션 실행
    insertUploadedTrackTransaction({
      fileHash, filePath, fileSize: fileBuffer.length,
      duration, bitrate, format, trackId, title
    });

    return { trackId, title };
    
  } catch (err) {
    // 🚨 핵심: 에러가 발생하면 디스크에 쓰다 만 쓰레기 파일을 즉시 삭제합니다!
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw err; // 에러를 Handler로 던져서 500 응답을 만들게 함
  }
}