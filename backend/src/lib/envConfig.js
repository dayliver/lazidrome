/**
 * 기동 시 필수 환경 변수 검증 및 CORS origin 목록.
 */

const DEV_JWT_SECRET = 'dev-only-set-JWT_SECRET-in-env';

export function resolveJwtSecret() {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    console.error(
      '[lazidrome] JWT_SECRET is required in production (min 16 characters).'
    );
    process.exit(1);
  }

  if (fromEnv && fromEnv.length < 16) {
    console.warn('[lazidrome] JWT_SECRET is short; use at least 16 characters.');
  }

  console.warn(
    '[lazidrome] JWT_SECRET not set — using development-only secret. Do not expose this server to the internet.'
  );
  return DEV_JWT_SECRET;
}

export function resolveAdminPassword() {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd || String(pwd).length < 1) {
    console.error('[lazidrome] ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }
  return String(pwd);
}

/** 쉼표 구분. 비어 있으면 로컬 Vite 기본값 */
/** 스트림·커버 URL용 HMAC 서명 TTL (초). 기본 2시간 */
export function resolveMediaTokenTtlSec() {
  const n = Number(process.env.MEDIA_TOKEN_TTL_SEC);
  if (Number.isFinite(n) && n >= 300 && n <= 86400) return Math.floor(n);
  return 7200;
}

export function resolveCorsOrigins() {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ];
}
