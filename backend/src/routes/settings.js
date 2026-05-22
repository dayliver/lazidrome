import { getSettingsHandler } from '../handlers/settings.get.js';

export default async function settingsRoutes(fastify) {
  fastify.get('/api/settings', getSettingsHandler);
}
