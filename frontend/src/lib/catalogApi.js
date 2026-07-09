/** GET /api/albums|artists 응답: 페이지 객체 또는 레거시 배열 */
export function normalizeCatalogResponse(body) {
  if (Array.isArray(body)) {
    return {
      items: body,
      total: body.length,
      offset: 0,
      limit: body.length,
      hasMore: false,
    }
  }
  if (body && Array.isArray(body.items)) {
    return {
      items: body.items,
      total: Number(body.total) || body.items.length,
      offset: Number(body.offset) || 0,
      limit: Number(body.limit) || body.items.length,
      hasMore: Boolean(body.hasMore),
    }
  }
  return { items: [], total: 0, offset: 0, limit: 0, hasMore: false }
}
