/** 클라이언트에 그대로내도 되는 검증/비즈니스 메시지 패턴 */
const CLIENT_MESSAGE_HINTS = [
  '비어',
  '사용할 수 없',
  '이하여야',
  '같습니다',
  '필수',
  '필요합니다',
  '유효하지',
  'Not found',
];

export function isClientSafeErrorMessage(message) {
  const msg = String(message || '');
  if (!msg || msg.length > 300) return false;
  return CLIENT_MESSAGE_HINTS.some((hint) => msg.includes(hint));
}

/**
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 * @param {unknown} err
 * @param {{ fallback?: string, statusCode?: number }} [opts]
 */
export function replyHttpError(request, reply, err, opts = {}) {
  const { fallback = '요청 처리 중 오류가 발생했습니다.', statusCode = 500 } = opts;
  request.log.error(err);
  const msg = err instanceof Error ? err.message : String(err || '');
  if (isClientSafeErrorMessage(msg)) {
    return reply.code(400).send({ error: msg });
  }
  return reply.code(statusCode).send({ error: fallback });
}
