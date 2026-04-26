import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';

const IMAGES_PATH = process.env.IMAGES_PATH || './storage/images';

export function tagCoverAbsolutePath(tagName) {
  const s = String(tagName || '').trim();
  if (!s) throw new Error('태그 이름이 비어 있습니다.');
  if (s.includes('..') || /[/\\]/.test(s)) {
    throw new Error('태그 이름에 경로 문자(/, \\)나 .. 는 사용할 수 없습니다.');
  }
  const tagsDir = path.join(IMAGES_PATH, 'tags');
  return path.join(tagsDir, `${s}.jpg`);
}

export async function saveTagCoverFromBuffer(tagName, buffer) {
  const dest = tagCoverAbsolutePath(tagName);
  const tagsDir = path.dirname(dest);
  if (!fs.existsSync(tagsDir)) fs.mkdirSync(tagsDir, { recursive: true });
  await sharp(buffer)
    .resize(800, 800, { fit: 'cover' })
    .jpeg({ quality: 90 })
    .toFile(dest);
}

export async function saveTagCoverFromUrl(tagName, url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) {
    throw new Error('http(s) URL만 허용됩니다.');
  }
  const res = await fetch(u);
  if (!res.ok) {
    throw new Error(`이미지 URL을 불러오지 못했습니다. (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await saveTagCoverFromBuffer(tagName, buf);
}

export function renameTagCoverFile(oldName, newName) {
  const oldPath = tagCoverAbsolutePath(oldName);
  const newPath = tagCoverAbsolutePath(newName);
  if (!fs.existsSync(oldPath)) return false;
  if (fs.existsSync(newPath)) fs.unlinkSync(newPath);
  fs.renameSync(oldPath, newPath);
  return true;
}
