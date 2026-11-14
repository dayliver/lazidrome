/**
 * @param {unknown} value
 * @param {{ empty: string, invalidChars: string, maxLength: string }} messages
 * @returns {string} error message or ''
 */
export function invalidTagName(value, messages) {
  const s = String(value || '').trim()
  if (!s) return messages.empty
  if (s.includes('..') || /[/\\]/.test(s)) return messages.invalidChars
  if (s.length > 200) return messages.maxLength
  return ''
}
