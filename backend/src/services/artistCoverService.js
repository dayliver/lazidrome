import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { downloadImage } from '../lib/downloader.js';
import { updateArtistCoverType } from '../repositories/artistRepository.js';

const COVERS_DIR = path.join(process.env.IMAGES_PATH || './storage/images', 'artists');

export async function saveArtistCoverFromUrl(artistId, url) {
  const ext = url.match(/\.(png|jpe?g|gif)$/i)?.[0] || '.jpg';
  const success = await downloadImage(url, `${artistId}${ext}`, COVERS_DIR);
  if (success) updateArtistCoverType(artistId, ext);
}

export async function saveArtistCoverFromBuffer(artistId, buffer) {
  if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });
  await sharp(buffer)
    .resize(800, 800, { fit: 'cover' })
    .jpeg({ quality: 90 })
    .toFile(path.join(COVERS_DIR, `${artistId}.jpg`));
  updateArtistCoverType(artistId, '.jpg');
}