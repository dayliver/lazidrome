import { getAdminDbOrphansHandler } from '../handlers/admin.db.get.js';
import { postAdminDbCleanupHandler } from '../handlers/admin.db.cleanup.post.js';

export default async function adminRoutes(fastify) {
  fastify.get('/api/admin/db/orphans', getAdminDbOrphansHandler);
  fastify.post('/api/admin/db/cleanup', postAdminDbCleanupHandler);
}
