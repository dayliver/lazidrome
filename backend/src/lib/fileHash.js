import fs from 'node:fs';
import crypto from 'node:crypto';

/**
 * 파일 전체를 메모리에 올리지 않고 SHA-256 해시 (스캐너·업로드용)
 * @param {string} filePath
 * @returns {Promise<string>} hex digest
 */
export function sha256FileStream(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
