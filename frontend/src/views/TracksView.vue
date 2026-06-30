<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import TracksListTable from '@/components/tracks/TracksListTable.vue'
import TracksPageFilters from '@/components/tracks/TracksPageFilters.vue'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import { useTracksPageQuery } from '@/composables/useTracksPageQuery'
import { Music } from 'lucide-vue-next'

const { t } = useI18n()
const router = useRouter()
const { showAuthEmpty } = useRequiresAuth()

const {
  query,
  searchInput,
  tracks,
  total,
  hasMore,
  isLoading,
  isLoadMore,
  loadMore,
  toggleStarredFilter,
  setMinRating,
  toggleSortColumn,
  sortState,
  sortPriority,
  activeSortCount,
} = useTracksPageQuery({ limit: 50 })

const description = computed(() =>
  t('pages.tracks.description', {
    total: total.value || 0,
    shown: tracks.value.length,
  })
)

const handleCreateTrack = () => {
  void router.push({ name: 'upload' })
}
</script>

<template>
  <PageLayout>
    <ViewHeader
      :title="t('pages.tracks.title')"
      :description="description"
      @action="handleCreateTrack"
    />

    <AuthEmptyState v-if="showAuthEmpty" />

    <div v-else class="space-y-4">
      <TracksPageFilters
        :search-input="searchInput"
        :starred="query.starred"
        :min-rating="query.minRating"
        :total="total"
        :shown="tracks.length"
        @update:search-input="searchInput = $event"
        @toggle-starred="toggleStarredFilter"
        @set-min-rating="setMinRating"
      />

      <div v-if="isLoading && tracks.length === 0" class="p-16 text-center text-muted-foreground flex flex-col items-center gap-4 bg-card rounded-xl border">
        <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p>{{ t('pages.tracks.loading') }}</p>
      </div>

      <div
        v-else-if="!isLoading && tracks.length === 0"
        class="py-16 text-center border-2 border-dashed rounded-2xl bg-muted/5 text-muted-foreground"
      >
        <Music class="w-12 h-12 mx-auto opacity-30 mb-3" />
        <p class="font-bold text-lg">{{ t('trackList.noResults') }}</p>
      </div>

      <div v-else class="bg-card overflow-hidden pb-4 rounded-xl border">
        <TracksListTable
          :tracks="tracks"
          :sort-state="sortState"
          :sort-priority="sortPriority"
          :active-sort-count="activeSortCount"
          @toggle-sort="toggleSortColumn"
        />

        <div v-if="hasMore" class="p-6 flex justify-center border-t mt-4">
          <Button
            variant="outline"
            class="w-full max-w-sm rounded-full shadow-none"
            :disabled="isLoadMore"
            @click="loadMore"
          >
            <span
              v-if="isLoadMore"
              class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"
            />
            {{ isLoadMore ? t('pages.tracks.loadingMore') : t('pages.tracks.loadMore') }}
          </Button>
        </div>
        <div v-else-if="tracks.length > 0" class="p-8 text-center text-xs text-muted-foreground">
          {{ t('pages.tracks.allLoaded') }}
        </div>
      </div>
    </div>
  </PageLayout>
</template>
