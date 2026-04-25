import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import cors from '@fastify/cors'; // 💉 수술: CORS 플러그인 추가
import fastifyStatic from '@fastify/static'; // 💉 추가: 정적 파일 엔진
import fastifyMultipart from '@fastify/multipart';
import path from 'node:path'; // 💉 추가: 경로 계산용
import dotenv from 'dotenv';
import { initDB } from './db.js';
import { startScanner } from './services/scanner.js';

import trackRoutes from './routes/tracks.js';
import artistRoutes from './routes/artists.js';
import streamRoutes from './routes/stream.js';
import uploadRoutes from './routes/upload.js';
import albumsRoutes from './routes/albums.js';
import tagsRoutes from './routes/tags.js';
import searchRoutes from './routes/search.js';
import imagesRoutes from './routes/images.js';
import playlistsRoutes from './routes/playlists.js';

// 1. 환경 변수 로드
dotenv.config();

// 2. DB 초기화 및 스캐너 가동
initDB();
const TRACKS_PATH = process.env.TRACKS_PATH || './storage/tracks';
const IMAGES_PATH = process.env.IMAGES_PATH || './storage/images';
startScanner(TRACKS_PATH);

const fastify = Fastify({ 
  logger: true,
  bodyLimit: 10485760 
});
const PORT = process.env.PORT || 5294;

// ==========================================
// 🛡️ 보안 및 인증 (CORS & JWT) 설정
// ==========================================

// 💉 핵심: CORS 설정 등록 (다른 설정보다 먼저 등록해야 preflight 요청을 정상 처리합니다)
fastify.register(cors, {
  origin: '*', // 개발 단계이므로 모든 도메인(포트)에서의 요청을 허용합니다.
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
});

// JWT 설정 등록
fastify.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'lazidrome-fallback-secret-key'
});

fastify.register(fastifyStatic, {
  root: path.resolve(IMAGES_PATH),
  // prefix: '/api/images/' 를 여기에 쓰지 마세요! 
  // 우리가 직접 images.js에서 라우트를 제어할 것이기 때문입니다.
  decorateReply: true 
});

fastify.register(fastifyMultipart);

// 전역 인증 데코레이터: API와 오디오 스트리밍을 모두 보호합니다.
fastify.decorate("authenticate", async (request, reply) => {
  try {
    // 💡 프론트엔드 <audio> 태그는 헤더를 못 보내므로 쿼리 스트링(token=)을 먼저 확인
    if (request.query.token) {
      const decoded = fastify.jwt.verify(request.query.token);
      request.user = decoded;
    } else {
      // 일반적인 API 통신(fetch)은 헤더의 Bearer 토큰을 확인
      await request.jwtVerify(); 
    }
  } catch (err) {
    reply.code(401).send({ error: '유효하지 않은 통행증입니다. 다시 로그인해주세요.' });
  }
});

// 로그인 엔드포인트 (이곳은 인증 없이 통과 가능해야 함)
fastify.post('/api/auth/login', async (request, reply) => {
  const { password } = request.body;

  // .env의 ADMIN_PASSWORD와 비교
  if (password === process.env.ADMIN_PASSWORD) {
    // 30일짜리 토큰(통행증) 발급
    const token = fastify.jwt.sign({ role: 'admin' }, { expiresIn: '30d' });
    return { token };
  }
  
  return reply.code(401).send({ error: '비밀번호가 올바르지 않습니다.' });
});

// ==========================================
// 🌐 라우트 등록
// ==========================================
fastify.get('/api', async () => {
  return { message: 'Hello Lazidrome!', db: 'Ready' };
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

// ==========================================
// 🚀 서버 실행
// ==========================================
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🎵 Lazidrome 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();