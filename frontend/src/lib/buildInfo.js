const BUILD_SKEW_MS = 10 * 60 * 1000;

export function formatBuildTime(iso) {
  if (!iso) return '알 수 없음';
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

/**
 * @param {{ version?: string | null, builtAt?: string | null } | null} frontend
 * @param {{ version?: string | null, builtAt?: string | null } | null} backend
 */
export function compareBuilds(frontend, backend) {
  if (!frontend?.builtAt || !backend?.builtAt) {
    return { status: 'unknown', message: '배포 시각 정보가 없습니다. npm run deploy로 다시 빌드하세요.' };
  }

  const fv = frontend.version ?? '';
  const bv = backend.version ?? '';
  const diff = Math.abs(new Date(frontend.builtAt).getTime() - new Date(backend.builtAt).getTime());

  if (fv && bv && fv !== bv) {
    return {
      status: 'mismatch',
      message: `버전 불일치 (프론트 ${fv} · 백엔드 ${bv}). deploy 후 서버 재시작을 확인하세요.`,
    };
  }

  if (diff <= BUILD_SKEW_MS) {
    return {
      status: 'ok',
      message: '프론트와 백엔드가 같은 배포(10분 이내)로 보입니다.',
    };
  }

  const newer =
    new Date(frontend.builtAt) > new Date(backend.builtAt) ? '프론트만 더 최신' : '백엔드만 더 최신';
  return {
    status: 'skew',
    message: `${newer}입니다. npm run deploy와 deploy:restart를 함께 실행했는지 확인하세요.`,
  };
}

/** 인증 없이 GET /api 의 build 필드 (헬스) */
export async function fetchBackendBuildFromHealth(serverUrl = '') {
  try {
    const base = (serverUrl || '').replace(/\/$/, '')
    const url = base ? `${base}/api` : '/api'
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return data?.build ?? null
  } catch {
    return null
  }
}

export async function fetchFrontendBuildInfo() {
  try {
    const base = import.meta.env.BASE_URL || '/';
    const url = `${base}build-info.json`.replace(/\/+/g, '/').replace(':/', '://');
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
