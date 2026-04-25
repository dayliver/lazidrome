import fs from 'node:fs';
import path from 'node:path';
import { getAggregatedTags } from '../repositories/tagRepository.js';

// 💡 Service 계층에서 캐시 상태를 안전하게 캡슐화(은닉)합니다.
let tagsCache = null;
let lastCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5분

export function getCachedTags() {
  if (tagsCache && (Date.now() - lastCacheTime < CACHE_TTL)) {
    return { cached: true, data: tagsCache };
  }
  return null;
}

export function fetchAndProcessTags() {
  const rawTags = getAggregatedTags();
  
  const IMAGES_PATH = process.env.IMAGES_PATH || './storage/images';
  const tagsDir = path.join(IMAGES_PATH, 'tags');
  
  if (!fs.existsSync(tagsDir)) fs.mkdirSync(tagsDir, { recursive: true });

  const processedTags = rawTags.map(tag => {
    const imagePath = path.join(tagsDir, `${tag.tag_name}.jpg`);
    const hasImage = fs.existsSync(imagePath);

    return {
      name: tag.tag_name,
      count: tag.count,
      hasImage: hasImage
    };
  });

  // 캐시 갱신
  tagsCache = processedTags;
  lastCacheTime = Date.now();

  return { cached: false, data: processedTags };
}

export function clearTagCache() {
  tagsCache = null;
  lastCacheTime = 0;
}