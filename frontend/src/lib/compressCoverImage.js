/**
 * 커버 업로드용 이미지를 JPEG로 리사이즈·압축한다.
 * 클립보드 PNG(무압축에 가까움)가 multipart 1MB 제한을 넘는 경우가 많아 서버 전에 처리.
 *
 * @param {File | Blob} file
 * @param {{ maxEdge?: number, quality?: number }} opts
 * @returns {Promise<File>}
 */
export async function compressCoverImage(file, { maxEdge = 1200, quality = 0.88 } = {}) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Not an image')
  }

  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height, 1))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not available')
    ctx.drawImage(bitmap, 0, 0, w, h)

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Compression failed'))),
        'image/jpeg',
        quality,
      )
    })

    const baseName = (file.name || 'cover').replace(/\.[^.]+$/, '') || 'cover'
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } finally {
    bitmap.close?.()
  }
}
