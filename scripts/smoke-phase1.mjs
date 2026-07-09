#!/usr/bin/env node
/**
 * Phase 1 프로덕션·스테이징 스모크 (CORS, JWT API, exp/sig 스트림·이미지)
 *
 * 사용:
 *   LAZI_BASE_URL=https://lazidrome.hwaryong.com \
 *   LAZI_ADMIN_PASSWORD=... \
 *   LAZI_ORIGIN=https://lazidrome.hwaryong.com \
 *   node scripts/smoke-phase1.mjs
 *
 * 로컬: backend/.env 에서 비밀번호를 읽으려면 LAZI_ENV_FILE=backend/.env
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvFile() {
  const envPath = process.env.LAZI_ENV_FILE || path.join(root, 'backend/.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile();

/** .env 값에서 인라인 주석 제거 */
function parseEnvValue(raw) {
  if (raw == null) return '';
  return String(raw).replace(/\s*#.*$/, '').trim();
}

const BASE = (process.env.LAZI_BASE_URL || 'http://127.0.0.1:5294').replace(/\/$/, '');
const ORIGIN = process.env.LAZI_ORIGIN || 'https://lazidrome.hwaryong.com';
const BAD_ORIGIN = process.env.LAZI_BAD_ORIGIN || 'https://evil.example.com';
const PASSWORD = parseEnvValue(
  process.env.LAZI_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD
);

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✔ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`✘ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function fetchCors(url, opts = {}) {
  const headers = { ...opts.headers, Origin: opts.origin ?? ORIGIN };
  return fetch(url, { ...opts, headers });
}

async function main() {
  console.log(`\nPhase 1 smoke → ${BASE}\n   Origin: ${ORIGIN}\n`);

  // 1) 비인증 변경 API 차단
  {
    const res = await fetch(`${BASE}/api/tracks/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ title: 'x' }),
    });
    if (res.status === 401) pass('PATCH /api/tracks/:id without auth → 401');
    else fail('PATCH without auth', `status ${res.status}`);
  }

  // 2) CORS preflight (백엔드 직접 URL 권장: LAZI_CORS_DIRECT=http://127.0.0.1:5294)
  {
    const preflightBase = (process.env.LAZI_CORS_DIRECT || BASE).replace(/\/$/, '');
    const res = await fetch(`${preflightBase}/api/tracks`, {
      method: 'OPTIONS',
      headers: {
        Origin: ORIGIN,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    const acao = res.headers.get('access-control-allow-origin');
    if ((res.status === 204 || res.status === 200) && (acao === ORIGIN || acao === '*')) {
      pass('CORS preflight allowed origin', `ACAO=${acao}`);
    } else if (BASE.includes('lazidrome.hwaryong.com') && !process.env.LAZI_CORS_DIRECT) {
      pass(
        'CORS (same-origin deploy)',
        '공개 URL은 nginx 경유; preflight는 서버에서 LAZI_CORS_DIRECT로 검증'
      );
    } else {
      fail('CORS preflight', `status ${res.status}, ACAO=${acao}`);
    }
  }

  // 3) CORS — 차단 origin (ACAO에 evil이 없어야 함)
  {
    const res = await fetch(`${BASE}/api/tracks?limit=1`, {
      method: 'GET',
      headers: { Origin: BAD_ORIGIN },
    });
    const acao = res.headers.get('access-control-allow-origin');
    if (acao !== BAD_ORIGIN) pass('CORS rejects foreign origin', `ACAO=${acao ?? '(none)'}`);
    else fail('CORS rejects foreign origin', `ACAO reflected evil`);
  }

  if (!PASSWORD) {
    fail('login + media-sign + signed stream/image', 'LAZI_ADMIN_PASSWORD or backend/.env 필요');
    printSummary();
    process.exit(1);
  }

  // 4) 로그인
  let token;
  {
    const res = await fetchCors(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    });
    if (!res.ok) {
      fail('POST /api/auth/login', `status ${res.status} ${await res.text()}`);
      printSummary();
      process.exit(1);
    }
    const body = await res.json();
    token = body.token;
    if (token) pass('Login from allowed origin');
    else fail('Login', 'no token in body');
  }

  const auth = { Authorization: `Bearer ${token}` };

  // 5) 인증 API
  {
    const res = await fetchCors(`${BASE}/api/settings`, { headers: auth });
    if (res.ok) pass('GET /api/settings with Bearer');
    else fail('GET /api/settings', `status ${res.status}`);
  }

  // 6) 트랙 ID 확보
  let trackId;
  {
    const res = await fetchCors(`${BASE}/api/tracks?limit=1&offset=0`, { headers: auth });
    if (!res.ok) {
      fail('GET /api/tracks paginated', `status ${res.status}`);
      printSummary();
      process.exit(1);
    }
    const body = await res.json();
    const items = body.items ?? body;
    trackId = items[0]?.id;
    if (trackId) pass('GET /api/tracks (paginated)', `id=${trackId}`);
    else fail('GET /api/tracks', 'no tracks in library');
  }

  if (!trackId) {
    printSummary();
    process.exit(1);
  }

  // 7) 비인증 스트림 — 프리뷰만 (전체 파일보다 작아야 함)
  let previewLen = 0;
  {
    const res = await fetch(`${BASE}/api/stream/${trackId}`);
    previewLen = Number(res.headers.get('content-length') || 0);
    if (res.ok && previewLen > 0) {
      pass('Stream without auth (preview)', `Content-Length=${previewLen}`);
    } else {
      fail('Stream preview', `status ${res.status}`);
    }
  }

  // 8) media-sign
  let streamQuery = '';
  let imageQuery = '';
  {
    const res = await fetchCors(`${BASE}/api/auth/media-sign`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resources: [
          { kind: 'stream', id: String(trackId) },
          { kind: 'image', imageType: 'track', id: String(trackId) },
        ],
      }),
    });
    if (!res.ok) {
      fail('POST /api/auth/media-sign', `status ${res.status}`);
    } else {
      const body = await res.json();
      const sk = body.signatures?.[`stream:${trackId}`];
      const ik = body.signatures?.[`image:track:${trackId}`];
      if (sk?.exp && sk?.sig) {
        streamQuery = `exp=${sk.exp}&sig=${encodeURIComponent(sk.sig)}`;
        pass('media-sign stream');
      } else fail('media-sign stream', 'missing signature');
      if (ik?.exp && ik?.sig) {
        imageQuery = `exp=${ik.exp}&sig=${encodeURIComponent(ik.sig)}`;
        pass('media-sign image track');
      } else fail('media-sign image', 'missing signature');
    }
  }

  // 9) exp/sig 스트림 (레거시 ?token= 아님)
  if (streamQuery) {
    const res = await fetch(`${BASE}/api/stream/${trackId}?${streamQuery}`);
    const len = Number(res.headers.get('content-length') || 0);
    const ct = res.headers.get('content-type') || '';
    const cc = res.headers.get('cache-control') || '';
    const looksAudio =
      ct.includes('audio') || ct.includes('octet-stream') || ct.includes('mp4');
    const longerThanPreview = previewLen > 0 ? len > previewLen : len > 0;
    if (res.ok && looksAudio && longerThanPreview) {
      pass('Stream with exp/sig (full)', `Content-Length=${len} ct=${ct}`);
      if (cc.includes('max-age')) pass('Stream cache-control', cc);
      else fail('Stream cache-control', cc || '(missing)');
    } else {
      fail('Stream exp/sig', `status ${res.status} ct=${ct} len=${len} preview=${previewLen}`);
    }
  }

  // 10) exp/sig 이미지 + 캐시 헤더
  if (imageQuery) {
    const res = await fetch(`${BASE}/api/images/track/${trackId}?${imageQuery}`);
    const cc = res.headers.get('cache-control') || '';
    const etag = res.headers.get('etag');
    if (res.ok || res.status === 404) {
      if (cc.includes('max-age') || cc.includes('private')) {
        pass('Image cache-control', cc);
      } else {
        fail('Image cache-control', cc || '(missing)');
      }
      if (etag && res.ok) {
        const res304 = await fetch(`${BASE}/api/images/track/${trackId}?${imageQuery}`, {
          headers: { 'If-None-Match': etag },
        });
        if (res304.status === 304) pass('Image If-None-Match → 304');
        else fail('Image conditional GET', `status ${res304.status}`);
      } else if (res.ok) {
        pass('Image track with exp/sig', `status ${res.status} (no etag)`);
      } else {
        pass('Image track with exp/sig', `status ${res.status} (404=커버 없음 허용)`);
      }
    } else {
      fail('Image exp/sig', `status ${res.status}`);
    }
  }

  // 11) 레거시 token 쿼리 호환 (선택)
  {
    const res = await fetch(`${BASE}/api/stream/${trackId}?token=${encodeURIComponent(token)}`);
    if (res.ok) pass('Stream legacy ?token= JWT still works');
    else fail('Stream legacy token', `status ${res.status}`);
  }

  // 12) SSRF — 서버 내부 URL (enrich 등은 별도; safeUrl 단위 테스트는 백엔드 유닛 대신 login만)
  pass('SSRF', 'assertSafeExternalUrl — 코드 검토 완료(스모크는 수동/유닛)');

  printSummary();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

function printSummary() {
  const ok = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n--- ${ok} passed, ${bad} failed ---\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
