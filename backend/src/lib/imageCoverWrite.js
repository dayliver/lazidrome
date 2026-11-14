import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { downloadImage } from './downloader.js';

/**
 * @param {string} entityId
 * @param {string} url
 * @param {string} coversDir
 * @param {(ext: string) => void} onSaved
 */
export async function saveCoverFromUrl(entityId, url, coversDir, onSaved) {
  const ext = url.match(/\.(png|jpe?g|gif)$/i)?.[0] || '.jpg';
  const success = await downloadImage(url, `${entityId}${ext}`, coversDir);
  if (success) onSaved(ext);
}

/**
 * @param {string} entityId
 * @param {Buffer} buffer
 * @param {string} coversDir
 * @param {(ext: string) => void} onSaved
 * @param {{ quality?: number }} [opts]
 */
export async function saveCoverFromBuffer(entityId, buffer, coversDir, onSaved, opts = {}) {
  const quality = opts.quality ?? 90;
  if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
  await sharp(buffer)
    .resize(800, 800, { fit: 'cover' })
    .jpeg({ quality })
    .toFile(path.join(coversDir, `${entityId}.jpg`));
  onSaved('.jpg');
}
