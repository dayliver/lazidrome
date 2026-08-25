import {
  getDevicesHandler,
  patchDeviceHandler,
  deleteDeviceHandler,
  deleteDevicePlaysHandler,
} from '../handlers/devices.js';

export default async function deviceRoutes(fastify) {
  fastify.get('/api/devices', { preHandler: [fastify.authenticate] }, getDevicesHandler);
  fastify.patch('/api/devices/:id', { preHandler: [fastify.authenticate] }, patchDeviceHandler);
  fastify.delete('/api/devices/:id', { preHandler: [fastify.authenticate] }, deleteDeviceHandler);
  // 프록시가 DELETE 바디를 떨어뜨리는 경우가 있어 기간 지정 삭제는 POST로 받는다
  fastify.post(
    '/api/devices/:id/plays/purge',
    { preHandler: [fastify.authenticate] },
    deleteDevicePlaysHandler
  );
}
