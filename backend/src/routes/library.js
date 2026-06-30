import { getLibraryRevisionHandler } from '../handlers/library.revision.get.js';

export default async function libraryRoutes(fastify) {
  fastify.get('/api/library/revision', getLibraryRevisionHandler);
}
