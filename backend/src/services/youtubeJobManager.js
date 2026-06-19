import { ulid } from 'ulid';
import { downloadOne } from './youtubeImportService.js';
import { buildDestDir } from '../lib/pathSanitize.js';
import { TRACKS_PATH } from '../lib/importEnv.js';

/** @type {Map<string, object>} */
const jobs = new Map();
let activeJobId = null;

export function hasActiveJob() {
  return activeJobId != null && jobs.get(activeJobId)?.status === 'running';
}

/**
 * @param {{ sourceUrl: string, items: Array<{ videoId: string, webpageUrl?: string, title: string, artist?: string, album?: string, trackNo?: number, selected?: boolean }> }} payload
 */
export function createJob(payload) {
  if (hasActiveJob()) {
    return { error: 'BUSY', message: '다른 가져오기 작업이 진행 중입니다.' };
  }

  const selected = (payload.items || []).filter((i) => i.selected !== false);
  if (!selected.length) {
    return { error: 'EMPTY', message: '선택된 항목이 없습니다.' };
  }

  const jobId = ulid();
  const job = {
    id: jobId,
    status: 'running',
    sourceUrl: payload.sourceUrl,
    total: selected.length,
    done: 0,
    failed: 0,
    current: null,
    createdAt: new Date().toISOString(),
    items: selected.map((item, idx) => ({
      index: idx,
      videoId: item.videoId,
      webpageUrl: item.webpageUrl,
      title: item.title,
      artist: item.artist,
      album: item.album,
      trackNo: item.trackNo,
      status: 'pending',
      error: null,
      destPath: null,
    })),
  };

  jobs.set(jobId, job);
  activeJobId = jobId;

  void runJob(jobId, payload.sourceUrl, selected);

  return { jobId };
}

async function runJob(jobId, sourceUrl, items) {
  const job = jobs.get(jobId);
  if (!job) return;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const row = job.items[i];
    if (!row) continue;

    job.current = item.title;
    row.status = 'downloading';

    const destDir = buildDestDir(TRACKS_PATH, {
      artist: item.artist,
      album: item.album,
    });

    try {
      const result = await downloadOne({
        videoId: item.videoId,
        webpageUrl: item.webpageUrl,
        sourceUrl,
        tags: {
          title: item.title,
          artist: item.artist,
          album: item.album,
          albumArtist: item.artist,
          trackNo: item.trackNo,
        },
        destDir,
      });
      row.status = 'done';
      row.destPath = result.destPath;
      job.done += 1;
    } catch (err) {
      row.status = 'error';
      row.error = err?.message || String(err);
      job.failed += 1;
      job.done += 1;
    }
  }

  job.status = job.failed === job.total ? 'failed' : 'completed';
  job.current = null;
  if (activeJobId === jobId) activeJobId = null;
}

export function getJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    sourceUrl: job.sourceUrl,
    total: job.total,
    done: job.done,
    failed: job.failed,
    current: job.current,
    createdAt: job.createdAt,
    items: job.items.map((r) => ({
      index: r.index,
      videoId: r.videoId,
      title: r.title,
      status: r.status,
      error: r.error,
      destPath: r.destPath,
    })),
  };
}
