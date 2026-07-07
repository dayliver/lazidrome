<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import { Input } from '@/components/ui/input'
import SafeImage from '@/components/shared/SafeImage.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import { Search, Hash, Tags } from 'lucide-vue-next'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import CreateTagDialog from '@/components/tags/CreateTagDialog.vue'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const { showAuthEmpty } = useRequiresAuth()

const tags = ref([])
const isLoading = ref(true)
const searchQuery = ref('')
const createOpen = ref(false)

const description = computed(() =>
  t('pages.tags.description', { count: tags.value.length })
)

const fetchTags = async () => {
  if (showAuthEmpty.value) {
    tags.value = []
    isLoading.value = false
    return
  }
  try {
    const res = await authStore.fetchWithAuth('/api/tags')
    const result = await res.json()
    if (result.success) {
      tags.value = result.data
    }
  } catch (err) {
    console.error(err)
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchTags)

watch(showAuthEmpty, () => {
  void fetchTags()
})

const filteredTags = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return tags.value
  return tags.value.filter((tag) => tag.name.toLowerCase().includes(q))
})

const featuredTags = computed(() => filteredTags.value.filter((tag) => tag.hasImage))

const goToTag = (name) => {
  router.push({ name: 'tag-detail', params: { name } })
}

const getTagImageUrl = (name) => authStore.coverSrc('tag', name)

const handleCreate = () => {
  createOpen.value = true
}
</script>

<template>
  <PageLayout spacing="8" class="animate-in fade-in duration-500">
    <ViewHeader
      :title="t('pages.tags.title')"
      :description="description"
      @action="handleCreate"
    >
      <template #title-prefix>
        <Tags class="inline w-8 h-8 text-primary mr-3" />
      </template>
    </ViewHeader>

    <AuthEmptyState v-if="showAuthEmpty" />

    <div v-else-if="isLoading" class="py-20 flex flex-col items-center justify-center text-muted-foreground">
      <span class="animate-spin border-4 border-primary/30 border-t-primary rounded-full w-10 h-10 mb-4" />
      <p class="font-bold tracking-tight">{{ t('pages.tags.loading') }}</p>
    </div>

    <template v-else>
      <section v-if="featuredTags.length > 0" class="space-y-4 animate-in slide-in-from-bottom-4">
        <h2 class="text-lg font-black tracking-tight flex items-center gap-2 px-1">
          <span class="text-primary">✨</span> {{ t('pages.tags.visualTitle') }}
        </h2>

        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div
            v-for="tag in featuredTags"
            :key="`feat-${tag.name}`"
            class="relative aspect-square rounded-2xl overflow-hidden cursor-pointer group shadow-sm border border-border/50 bg-muted"
            @click="goToTag(tag.name)"
          >
            <SafeImage
              :src="getTagImageUrl(tag.name)"
              type="tag"
              class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 opacity-80 group-hover:opacity-100 transition-opacity" />

            <div class="absolute inset-0 flex flex-col items-center justify-center p-4 text-white">
              <span class="font-black text-2xl tracking-tight text-center drop-shadow-lg group-hover:text-primary transition-colors">{{ tag.name }}</span>
              <span class="text-[11px] font-bold opacity-80 mt-1 uppercase tracking-widest">
                {{ t('pages.tags.itemCount', { count: tag.count }) }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-4 pt-4 animate-in slide-in-from-bottom-8">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20 p-4 rounded-xl border">
          <h2 class="text-lg font-black tracking-tight px-1">{{ t('pages.tags.allTitle') }}</h2>
          <div class="relative w-full sm:w-80">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              :placeholder="t('pages.tags.searchPlaceholder')"
              class="pl-9 bg-background border-2 focus-visible:ring-primary font-bold shadow-sm"
            />
          </div>
        </div>

        <div v-if="filteredTags.length === 0" class="py-16 text-center border-2 border-dashed rounded-2xl bg-muted/5">
          <Hash class="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p class="font-bold text-muted-foreground text-lg">{{ t('pages.tags.noResults') }}</p>
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div
            v-for="tag in filteredTags"
            :key="tag.name"
            class="flex items-center justify-between p-3.5 bg-card border-2 rounded-xl hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all group"
            @click="goToTag(tag.name)"
          >
            <div class="flex items-center gap-2 min-w-0">
              <Hash class="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
              <span class="font-bold text-sm truncate group-hover:text-foreground transition-colors">{{ tag.name }}</span>
            </div>
            <span class="text-[10px] font-mono font-black text-muted-foreground bg-muted px-2 py-1 rounded-md group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              {{ tag.count }}
            </span>
          </div>
        </div>
      </section>
    </template>

    <CreateTagDialog v-model:is-open="createOpen" />
  </PageLayout>
</template>
