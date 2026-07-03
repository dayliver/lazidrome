export function getPageShareUrl() {
  return window.location.href
}

export function formatShareMarkdown(label, url = getPageShareUrl()) {
  const text = String(label ?? '').trim()
  if (!text) return url
  const safe = text.replace(/\\/g, '\\\\').replace(/\]/g, '\\]')
  return `[${safe}](${url})`
}

export async function copyText(text) {
  const value = String(text ?? '')
  if (!value) throw new Error('empty')
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = value
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)
  if (!ok) throw new Error('copy failed')
}
