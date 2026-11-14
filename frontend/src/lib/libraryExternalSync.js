/**
 * Lightweight pub/sub for catalog row patches after metadata saves.
 * One hub per entity keeps subscribe/emit pairs identical.
 */
export function createExternalSyncHub() {
  const listeners = new Set()

  const subscribe = (listener) => {
    if (typeof listener !== 'function') return () => {}
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  const emit = (payload) => {
    if (!payload) return
    for (const fn of listeners) {
      try {
        fn(payload)
      } catch (e) {
        console.error(e)
      }
    }
  }

  return { subscribe, emit }
}
