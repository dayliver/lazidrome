import { t } from '@/i18n/t'
import { formatLocaleDateTime } from '@/lib/localeFormat'

const BUILD_SKEW_MS = 10 * 60 * 1000;

export function formatBuildTime(iso) {
  if (!iso) return t('settings.deploy.unknownTime');
  return formatLocaleDateTime(iso, { dateStyle: 'medium', timeStyle: 'short' }) || iso;
}

/**
 * @param {{ version?: string | null, builtAt?: string | null } | null} frontend
 * @param {{ version?: string | null, builtAt?: string | null } | null} backend
 */
export function compareBuilds(frontend, backend) {
  if (!frontend?.builtAt || !backend?.builtAt) {
    return { status: 'unknown', message: t('settings.deploy.noDeployInfo') };
  }

  const fv = frontend.version ?? '';
  const bv = backend.version ?? '';
  const diff = Math.abs(new Date(frontend.builtAt).getTime() - new Date(backend.builtAt).getTime());

  if (fv && bv && fv !== bv) {
    return {
      status: 'mismatch',
      message: t('settings.deploy.versionMismatch', { frontend: fv, backend: bv }),
    };
  }

  if (diff <= BUILD_SKEW_MS) {
    return {
      status: 'ok',
      message: t('settings.deploy.buildsInSync'),
    };
  }

  const newer =
    new Date(frontend.builtAt) > new Date(backend.builtAt)
      ? t('settings.deploy.frontendNewer')
      : t('settings.deploy.backendNewer');
  return {
    status: 'skew',
    message: t('settings.deploy.buildSkew', { newer }),
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
