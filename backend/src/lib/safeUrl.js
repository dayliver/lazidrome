import { lookup } from 'node:dns/promises';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
]);

function isPrivateIpv4(host) {
  const parts = host.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIpv6(host) {
  const h = host.toLowerCase();
  if (h === '::1' || h === '::') return true;
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // unique local
  if (h.startsWith('fe80')) return true; // link-local
  return false;
}

function hostnameLooksBlocked(hostname) {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith('.localhost')) return true;
  if (isPrivateIpv4(h)) return true;
  if (h.includes(':') && isPrivateIpv6(h)) return true;
  return false;
}

/**
 * 외부 커버 이미지 등 사용자/Last.fm URL fetch 전 검사.
 * @throws {Error} 안전하지 않으면
 */
export async function assertSafeExternalUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URL credentials are not allowed');
  }

  const host = parsed.hostname;
  if (hostnameLooksBlocked(host)) {
    throw new Error('URL host is not allowed');
  }

  // numeric IP already checked; resolve DNS for hostnames
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && !host.includes(':')) {
    try {
      const records = await lookup(host, { all: true });
      for (const r of records) {
        if (hostnameLooksBlocked(r.address)) {
          throw new Error('URL resolves to a private address');
        }
      }
    } catch (err) {
      if (err.message?.includes('private')) throw err;
      throw new Error('URL host could not be resolved safely');
    }
  }

  return parsed;
}
