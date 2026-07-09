<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '@/stores/library'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import { useAddMediaAction } from '@/composables/useAddMediaAction'
import { useCatalogPageQuery } from '@/composables/useCatalogPageQuery'
import { Disc, Plus, Loader2 } from 'lucide-vue-next'
import AlbumGrid from '@/components/shared/AlbumGrid.vue'
import CreateAlbumDialog from '@/components/albums/CreateAlbumDialog.vue'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const { t } = useI18n()
const library = useLibraryStore()
const { showAuthEmpty } = useRequiresAuth()
const { goAddMedia } = useAddMediaAction()

const createOpen = ref(false)

const {
  items: albumsData,
  total,
  hasMore,
  isLoading,
  isLoadMore,
  loadMore,
  reload,
} = useCatalogPageQuery({
  limit: 60,
  fetchPage: (opts) => library.fetchAlbumsPage(opts),
})

const description = computed(() =>
  t('pages.albums.description', { count: total.value || albumsData.value.length }),
)

const onAlbumCreated = () => {
  void reload()
}
</script>

<template>
  <PageLayout>
    <ViewHeader
      :title="t('pages.albums.title')"
      :description="description"
      :show-action="false"
    >
      <template #actions>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="icon" class="rounded-full">
              <Plus class="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-44">
            <DropdownMenuItem @click="createOpen = true">
              {{ t('pages.albums.createTitle') }}
            </DropdownMenuItem>
            <DropdownMenuItem @click="goAddMedia">
              {{ t('pages.albums.addMusic') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </template>
    </ViewHeader>

    <AuthEmptyState v-if="showAuthEmpty" />

    <LoadingSpinner v-else-if="isLoading && !albumsData.length" :label="t('pages.albums.loading')" />

    <EmptyState v-else-if="!isLoading && albumsData.length === 0" :icon="Disc" :title="t('pages.albums.empty')" />

    <template v-else>
      <AlbumGrid :albums="albumsData" />
      <div v-if="hasMore" class="flex justify-center pt-4 pb-8">
        <Button variant="outline" class="rounded-full" :disabled="isLoadMore" @click="loadMore">
          <Loader2 v-if="isLoadMore" class="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
          {{ isLoadMore ? t('pages.albums.loading') : t('pages.tracks.loadMore') }}
        </Button>
      </div>
    </template>

    <CreateAlbumDialog v-model:is-open="createOpen" @success="onAlbumCreated" />
  </PageLayout>
</template>
