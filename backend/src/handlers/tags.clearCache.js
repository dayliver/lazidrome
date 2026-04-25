import { clearTagCache } from '../services/tagService.js';

export async function clearTagCacheHandler(request, reply) {
  clearTagCache();
  return { success: true, message: 'Tag cache cleared' };
}