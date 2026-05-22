/** @param {{ exp: number, sig: string }} sig */
export function formatMediaQuery({ exp, sig }) {
  return `exp=${exp}&sig=${encodeURIComponent(sig)}`
}

export function imageResourceKey(type, id) {
  if (type === 'tag') return `image:tag:${String(id)}`
  return `image:${type}:${String(id)}`
}

export function streamResourceKey(id) {
  return `stream:${String(id)}`
}
