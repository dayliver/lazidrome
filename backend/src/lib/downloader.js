// backend/src/lib/downloader.js
import fs from 'node:fs';
import path from 'node:path';
import { assertSafeExternalUrl } from './safeUrl.js';

/**
 * 외부 URL에서 이미지를 다운로드하여 로컬 디렉토리에 저장합니다.
 * @param {string} url - 다운로드할 이미지 URL (Last.fm 제공)
 * @param {string} filename - 저장할 파일명 (예: '01ARZ3NDEKTSV4RRFFQ69G5FAV.jpg')
 * @param {string} targetDir - 저장할 디렉토리 (기본값: 'storage/images')
 * @returns {Promise<boolean>} 저장 성공 여부
 */
export async function downloadImage(url, filename, targetDir = 'storage/images') {
  if (!url) return false;

  try {
    // 1. 저장할 폴더 절대 경로 확보 및 확인 (없으면 자동 생성)
    const dirPath = path.resolve(process.cwd(), targetDir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, filename);

    await assertSafeExternalUrl(url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP 상태 코드 에러: ${response.status}`);
    }

    // 3. 데이터를 버퍼로 변환하여 파일로 저장
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    fs.writeFileSync(filePath, buffer);
    
    console.log(`🖼️ [Downloader] 앨범 커버 저장 완료: ${filename}`);
    return true;

  } catch (error) {
    console.error(`❌ [Downloader] 이미지 다운로드 실패 (${filename}):`, error.message);
    return false;
  }
}