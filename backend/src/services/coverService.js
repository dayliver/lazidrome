import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { downloadImage } from '../lib/downloader.js';
import { updateAlbumCoverType } from '../repositories/albumRepository.js';

const COVERS_DIR = path.join(process.env.IMAGES_PATH || './storage/images', 'albums');

export async function saveCoverFromUrl(albumId, url) {
  const ext = url.match(/\.(png|jpe?g|gif)$/i)?.[0] || '.jpg';
  const success = await downloadImage(url, `${albumId}${ext}`, COVERS_DIR);
  if (success) updateAlbumCoverType(albumId, ext);
}

export async function saveCoverFromBuffer(albumId, buffer) {
  if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });
  await sharp(buffer)
    .resize(800, 800, { fit: 'cover' })
    .jpeg({ quality: 90 })
    .toFile(path.join(COVERS_DIR, `${albumId}.jpg`));
  updateAlbumCoverType(albumId, '.jpg');
}