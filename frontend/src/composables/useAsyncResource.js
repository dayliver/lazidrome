import { ref, watch, unref } from 'vue'

/**
 * 라우트 파라미터 등 단일 키가 바뀔 때마다 비동기로 데이터를 불러옵니다.
 *
 * @template T
 * @param {import('vue').MaybeRefOrGetter<string|undefined|null>} keySource
 * @param {(key: string) => Promise<T>} fetcher
 * @param {{ immediate?: boolean }} [options]
 * @returns {{
 *   data: import('vue').Ref<T | null>,
 *   error: import('vue').Ref<string | null>,
 *   isLoading: import('vue').Ref<boolean>,
 *   reload: () => Promise<void>
 * }}
 */
export function useAsyncResource(keySource, fetcher, options = {}) {
  const { immediate = true } = options
  const data = ref(null)
  const error = ref(null)
  const isLoading = ref(false)

  const resolveKey = () => {
    const raw = typeof keySource === 'function' ? keySource() : unref(keySource)
    if (raw == null || raw === '') return null
    return String(raw)
  }

  const reload = async () => {
    const key = resolveKey()
    if (key == null) {
      data.value = null
      error.value = null
      isLoading.value = false
      return
    }

    isLoading.value = true
    error.value = null
    try {
      data.value = await fetcher(key)
    } catch (e) {
      error.value = e?.message || String(e)
      data.value = null
    } finally {
      isLoading.value = false
    }
  }

  watch(
    () => resolveKey(),
    () => {
      void reload()
    },
    { immediate }
  )

  return { data, error, isLoading, reload }
}
