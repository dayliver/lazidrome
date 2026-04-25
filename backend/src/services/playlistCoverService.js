import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';

export async function savePlaylistCoverImage(id, buffer) {
  if (!buffer) return null;
  const uploadDir = path.join(process.cwd(), 'storage', 'images', 'playlists');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  
  const imagePath = path.join(uploadDir, `${id}.jpg`);
  await sharp(buffer).resize(800, 800, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(imagePath);
  
  return 'jpg'; 
}