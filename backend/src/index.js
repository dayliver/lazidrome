import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import crypto from 'node:crypto';
import path from 'node:path';
import dotenv from 'dotenv';
import { initDB } from './db.js';
import { startScanner } from './services/scanner.js';
import { resolveJwtSecret, resolveAdminPassword, resolveCorsOrigins, resolveMediaTokenTtlSec } from './lib/envConfig.js';
import { rebindTrackFilePaths } from './lib/trackPath.js';
import { createMediaSignHandler } from './handlers/auth.mediaSign.post.js';
import { isPublicApiRoute } from './lib/apiAuthPolicy.js';
import { getBackendBuildInfo } from './lib/buildInfo.js';

import trackRoutes from './routes/tracks.js';
import artistRoutes from './routes/artists.js';
import streamRoutes from './routes/stream.js';
import uploadRoutes from './routes/upload.js';
import albumsRoutes from './routes/albums.js';
import tagsRoutes from './routes/tags.js';
import searchRoutes from './routes/search.js';
import imagesRoutes from './routes/images.js';
import playlistsRoutes from './routes/playlists.js';
import homeRoutes from './routes/home.js';
import visitsRoutes from './routes/visits.js';
import statsRoutes from './routes/stats.js';
import settingsRoutes from './routes/settings.js';
import libraryRoutes from './routes/library.js';
import adminRoutes from './routes/admin.js';
import importRoutes from './routes/import.js';
import filesRoutes from './routes/files.js';
import playbackRoutes from './routes/playback.js';

dotenv.config();

const JWT_SECRET = resolveJwtSecret();
const ADMIN_PASSWORD = resolveAdminPassword();
const CORS_ORIGINS = resolveCorsOrigins();
const MEDIA_TOKEN_TTL_SEC = resolveMediaTokenTtlSec();

initDB();
const TRACKS_PATH = process.env.TRACKS_PATH || './storage/tracks';
const IMAGES_PATH = process.env.IMAGES_PATH || './storage/images';
rebindTrackFilePaths(TRACKS_PATH);
startScanner(TRACKS_PATH);

const fastify = Fastify({
  logger: true,
  bodyLimit: 85 * 1024 * 1024,
});
const PORT = process.env.PORT || 5294;

fastify.register(cors, {
  origin: (origin, cb) => {
    // Origin 없음: curl·서버 간 요청
    if (!origin) return cb(null, true);
    if (CORS_ORIGINS.includes(origin)) return cb(null, origin);
    fastify.log.warn({ origin, allowed: CORS_ORIGINS }, 'CORS origin rejected');
    cb(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflight: false,
});

/** Fastify 5 + 플러그인 조합에서 OPTIONS * 라우트가 404일 때 — preflight를 훅에서 직접 처리 */
fastify.addHook('onRequest', async (request, reply) => {
  if (request.method !== 'OPTIONS' || !request.url.startsWith('/api')) return;

  const origin = request.headers.origin;
  if (!origin || !CORS_ORIGINS.includes(origin)) {
    return reply.code(403).send({ error: 'CORS preflight denied' });
  }

  reply.header('Access-Control-Allow-Origin', origin);
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  reply.header('Access-Control-Max-Age', '86400');
  reply.header('Vary', 'Origin');

  if (request.headers['access-control-request-method']) {
    return reply.code(204).send();
  }
});

fastify.register(rateLimit, {
  global: true,
  max: 300,
  timeWindow: '1 minute',
});

fastify.register(fastifyJwt, {
  secret: JWT_SECRET,
});

fastify.register(fastifyStatic, {
  root: path.resolve(IMAGES_PATH),
  decorateReply: true,
});

// 커버 이미지·업로드: 클립보드 PNG 등이 기본 1MB 제한을 쉽게 넘김
fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 80 * 1024 * 1024, // 음원 업로드 (bodyLimit 85MB 이내)
    files: 1,
  },
});

fastify.decorate('mediaSigningSecret', JWT_SECRET);

fastify.decorate('authenticate', async (request, reply) => {
  try {
    if (request.query.token) {
      const decoded = fastify.jwt.verify(request.query.token);
      request.user = decoded;
    } else {
      await request.jwtVerify();
    }
  } catch {
    reply.code(401).send({ error: '유효하지 않은 통행증입니다. 다시 로그인해주세요.' });
  }
});

function passwordsMatch(input, expected) {
  const a = Buffer.from(String(input ?? ''), 'utf8');
  const b = Buffer.from(String(expected), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

fastify.addHook('preHandler', async (request, reply) => {
  const routerPath = request.routeOptions?.url ?? request.routerPath;
  const method = request.method;

  // 브라우저 CORS preflight — JWT 검사 전에 통과 (@fastify/cors onRequest와 함께)
  if (method === 'OPTIONS') return;

  if (!routerPath?.startsWith('/api')) return;
  if (isPublicApiRoute(method, routerPath)) return;

  await fastify.authenticate(request, reply);
});

fastify.post('/api/auth/login', {
  config: {
    rateLimit: {
      max: 10,
      timeWindow: '15 minutes',
    },
  },
}, async (request, reply) => {
  const { password } = request.body ?? {};
  if (typeof password !== 'string' || !password.length) {
    return reply.code(400).send({ error: '비밀번호를 입력해주세요.' });
  }

  if (!passwordsMatch(password, ADMIN_PASSWORD)) {
    return reply.code(401).send({ error: '비밀번호가 올바르지 않습니다.' });
  }

  const token = fastify.jwt.sign({ role: 'admin' }, { expiresIn: '30d' });
  return { token };
});

fastify.post('/api/auth/media-sign', {
  preHandler: [fastify.authenticate],
  config: {
    rateLimit: {
      max: 120,
      timeWindow: '1 minute',
    },
  },
}, createMediaSignHandler(JWT_SECRET, MEDIA_TOKEN_TTL_SEC));

fastify.get('/api', async () => {
  return { message: 'Hello Lazidrome!', db: 'Ready', build: getBackendBuildInfo() };
});

fastify.register(trackRoutes);
fastify.register(artistRoutes);
fastify.register(streamRoutes);
fastify.register(uploadRoutes);
fastify.register(albumsRoutes);
fastify.register(tagsRoutes);
fastify.register(searchRoutes);
fastify.register(imagesRoutes);
fastify.register(playlistsRoutes);
fastify.register(homeRoutes);
fastify.register(visitsRoutes);
fastify.register(statsRoutes);
fastify.register(settingsRoutes);
fastify.register(libraryRoutes);
fastify.register(adminRoutes);
fastify.register(importRoutes);
fastify.register(filesRoutes);
fastify.register(playbackRoutes);

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🎵 Lazidrome 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    console.log(`   CORS origins: ${CORS_ORIGINS.join(', ')}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
