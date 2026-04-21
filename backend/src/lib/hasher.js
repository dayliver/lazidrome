import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

/**
 * 파일의 SHA-256 해시를 생성합니다.
 * @param {string} filePath 
 * @returns {Promise<string>}
 */
export async function getFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(`sha256:${hash.digest('hex')}`));
    stream.on('error', (err) => reject(err));
  });
}