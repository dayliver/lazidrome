import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';

export const useImportStore = defineStore('import', () => {
  const auth = useAuthStore();
  const resolving = ref(false);
  const resolveError = ref(null);
  const resolved = ref(null);

  const jobId = ref(null);
  const jobStatus = ref(null);
  const polling = ref(false);

  const staging = ref(false);
  const committing = ref(false);

  async function resolveYoutube(url) {
    resolving.value = true;
    resolveError.value = null;
    resolved.value = null;
    try {
      const res = await auth.fetchWithAuth('/api/import/youtube/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || res.statusText);
      }
      resolved.value = body.data;
      return body.data;
    } catch (e) {
      resolveError.value = e;
      throw e;
    } finally {
      resolving.value = false;
    }
  }

  async function startImport(url, items) {
    const res = await auth.fetchWithAuth('/api/import/youtube/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, items }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.error || res.statusText);
    }
    jobId.value = body.data?.jobId ?? null;
    return jobId.value;
  }

  async function fetchJobStatus(id) {
    const res = await auth.fetchWithAuth(`/api/import/youtube/jobs/${encodeURIComponent(id)}`);
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.error || res.statusText);
    }
    jobStatus.value = body.data;
    return body.data;
  }

  async function pollJobUntilDone(id, { intervalMs = 1500, onTick } = {}) {
    polling.value = true;
    try {
      for (;;) {
        const status = await fetchJobStatus(id);
        onTick?.(status);
        if (status.status === 'completed' || status.status === 'failed') {
          return status;
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    } finally {
      polling.value = false;
    }
  }

  /** multipart — 파일 1개 스테이징 */
  async function stageLocalFile(file) {
    staging.value = true;
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      const res = await auth.fetchWithAuth('/api/upload/staging', {
        method: 'POST',
        body: form,
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || res.statusText);
      }
      return body.data;
    } finally {
      staging.value = false;
    }
  }

  async function commitLocalUploads(items) {
    committing.value = true;
    try {
      const res = await auth.fetchWithAuth('/api/upload/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || res.statusText);
      }
      return body;
    } finally {
      committing.value = false;
    }
  }

  async function cancelStaging(stagingId) {
    const res = await auth.fetchWithAuth(`/api/upload/staging/${encodeURIComponent(stagingId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || res.statusText);
    }
  }

  function reset() {
    resolving.value = false;
    resolveError.value = null;
    resolved.value = null;
    jobId.value = null;
    jobStatus.value = null;
    polling.value = false;
  }

  return {
    resolving,
    resolveError,
    resolved,
    jobId,
    jobStatus,
    polling,
    staging,
    committing,
    resolveYoutube,
    startImport,
    fetchJobStatus,
    pollJobUntilDone,
    stageLocalFile,
    commitLocalUploads,
    cancelStaging,
    reset,
  };
});
