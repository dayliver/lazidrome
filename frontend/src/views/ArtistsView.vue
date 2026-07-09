<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '@/stores/library'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import { useCatalogPageQuery } from '@/composables/useCatalogPageQuery'
import { Users, Loader2 } from 'lucide-vue-next'
import ArtistGrid from '@/components/shared/ArtistGrid.vue'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import { Button } from '@/components/ui/button'

const { t } = useI18n()
const library = useLibraryStore()
const { showAuthEmpty } = useRequiresAuth()

const {
  items: artistsData,
  total,
  hasMore,
  isLoading,
  isLoadMore,
  loadMore,
} = useCatalogPageQuery({
  limit: 60,
  fetchPage: (opts) => library.fetchArtistsPage(opts),
})

const description = computed(() =>
  t('pages.artists.description', { count: total.value || artistsData.value.length }),
)
</script>

<template>
  <PageLayout>
    <ViewHeader
      :title="t('pages.artists.title')"
      :description="description"
      :show-action="false"
    />

    <AuthEmptyState v-if="showAuthEmpty" />

    <LoadingSpinner v-else-if="isLoading && !artistsData.length" :label="t('pages.artists.loading')" />

    <EmptyState v-else-if="!isLoading && artistsData.length === 0" :icon="Users" :title="t('pages.artists.empty')" />

    <template v-else>
      <ArtistGrid :artists="artistsData" />
      <div v-if="hasMore" class="flex justify-center pt-4 pb-8">
        <Button variant="outline" class="rounded-full" :disabled="isLoadMore" @click="loadMore">
          <Loader2 v-if="isLoadMore" class="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
          {{ isLoadMore ? t('pages.artists.loading') : t('pages.tracks.loadMore') }}
        </Button>
      </div>
    </template>
  </PageLayout>
</template>
