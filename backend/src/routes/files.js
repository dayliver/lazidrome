import { getFilesListHandler } from '../handlers/files.list.get.js';
import { deleteFilesEntryHandler } from '../handlers/files.delete.js';

export default async function filesRoutes(fastify) {
  fastify.get('/api/files', getFilesListHandler);
  fastify.delete('/api/files', deleteFilesEntryHandler);
}
