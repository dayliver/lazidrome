<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '@/stores/library'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import ArtistGrid from '@/components/shared/ArtistGrid.vue'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'

const { t } = useI18n()
const library = useLibraryStore()
const { showAuthEmpty } = useRequiresAuth()

const artistsData = ref([])
const isLoading = ref(true)

const description = computed(() =>
  t('pages.artists.description', { count: artistsData.value.length })
)

const loadArtists = async () => {
  if (showAuthEmpty.value) {
    artistsData.value = []
    isLoading.value = false
    return
  }
  isLoading.value = true
  try {
    const data = await library.getArtists()
    artistsData.value = data || []
  } finally {
    isLoading.value = false
  }
}

onMounted(loadArtists)

watch(showAuthEmpty, () => {
  void loadArtists()
})
</script>

<template>
  <PageLayout spacing="10">
    <ViewHeader
      :title="t('pages.artists.title')"
      :description="description"
      :show-action="false"
    />

    <AuthEmptyState v-if="showAuthEmpty" />

    <template v-else>
      <div v-if="isLoading" class="flex items-center gap-3 py-6 text-sm text-muted-foreground">
        <div class="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        {{ t('pages.artists.loading') }}
      </div>

      <p v-else-if="!artistsData.length" class="text-sm text-muted-foreground py-4">
        {{ t('pages.artists.empty') }}
      </p>

      <ArtistGrid v-else :artists="artistsData" />
    </template>
  </PageLayout>
</template>
