import { ref, watch, onMounted } from 'vue'
import { useRequiresAuth } from '@/composables/useRequiresAuth'

export function useCatalogPageQuery({ fetchPage, limit = 60 }) {
  const { showAuthEmpty } = useRequiresAuth()

  const items = ref([])
  const total = ref(0)
  const offset = ref(0)
  const hasMore = ref(true)
  const isLoading = ref(false)
  const isLoadMore = ref(false)

  let loadGeneration = 0

  const load = async (append = false) => {
    if (showAuthEmpty.value) {
      items.value = []
      total.value = 0
      hasMore.value = false
      isLoading.value = false
      return
    }

    const generation = ++loadGeneration
    if (!append) isLoading.value = true
    else isLoadMore.value = true

    try {
      const page = await fetchPage({ offset: offset.value, limit })
      if (generation !== loadGeneration) return

      total.value = page.total
      hasMore.value = page.hasMore
      items.value = append ? [...items.value, ...page.items] : page.items
    } catch (error) {
      if (generation !== loadGeneration) return
      console.error(error)
      if (!append) items.value = []
      hasMore.value = false
    } finally {
      if (generation === loadGeneration) {
        isLoading.value = false
        isLoadMore.value = false
      }
    }
  }

  const reload = async () => {
    offset.value = 0
    hasMore.value = true
    await load(false)
  }

  const loadMore = async () => {
    if (!hasMore.value || isLoadMore.value || isLoading.value) return
    offset.value += limit
    await load(true)
  }

  watch(showAuthEmpty, () => {
    void reload()
  })

  onMounted(() => {
    void reload()
  })

  return {
    items,
    total,
    hasMore,
    isLoading,
    isLoadMore,
    loadMore,
    reload,
  }
}
