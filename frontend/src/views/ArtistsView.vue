<script setup>
import { ref, computed, watch } from 'vue'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const { t } = useI18n()
const library = useLibraryStore()
const { showAuthEmpty } = useRequiresAuth()

const sort = ref('listenDesc')

const sortOptions = computed(() => [
  { value: 'listenDesc', label: t('pages.artists.sort.listenDesc') },
  { value: 'tracksDesc', label: t('pages.artists.sort.tracksDesc') },
  { value: 'nameAsc', label: t('pages.artists.sort.nameAsc') },
  { value: 'addedDesc', label: t('pages.artists.sort.addedDesc') },
  { value: 'addedAsc', label: t('pages.artists.sort.addedAsc') },
])

const {
  items: artistsData,
  total,
  hasMore,
  isLoading,
  isLoadMore,
  loadMore,
  reload,
} = useCatalogPageQuery({
  limit: 60,
  fetchPage: (opts) => library.fetchArtistsPage({ ...opts, sort: sort.value }),
})

watch(sort, () => {
  void reload()
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

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <Label class="text-sm text-muted-foreground shrink-0">{{ t('pages.artists.sortLabel') }}</Label>
        <Select v-model="sort">
          <SelectTrigger class="w-[240px]">
            <SelectValue :placeholder="t('pages.artists.sortLabel')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <LoadingSpinner v-if="isLoading && !artistsData.length" :label="t('pages.artists.loading')" />

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
    </template>
  </PageLayout>
</template>
