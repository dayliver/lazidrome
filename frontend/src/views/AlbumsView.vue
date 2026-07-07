<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import { useAddMediaAction } from '@/composables/useAddMediaAction'
import { Disc, Plus } from 'lucide-vue-next'
import AlbumGrid from '@/components/shared/AlbumGrid.vue'
import CreateAlbumDialog from '@/components/albums/CreateAlbumDialog.vue'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const { t } = useI18n()
const library = useLibraryStore()
const auth = useAuthStore()
const { showAuthEmpty } = useRequiresAuth()
const { goAddMedia } = useAddMediaAction()

const albumsData = ref([])
const isLoading = ref(true)
const createOpen = ref(false)

const description = computed(() =>
  t('pages.albums.description', { count: albumsData.value.length })
)

const loadAlbums = async () => {
  if (showAuthEmpty.value) {
    albumsData.value = []
    isLoading.value = false
    return
  }
  isLoading.value = true
  try {
    const data = await library.getAlbums()
    albumsData.value = data || []
    const coverIds = albumsData.value.filter((a) => a.cover_type).map((a) => a.id)
    if (coverIds.length) {
      await auth.prefetchImageSignatures('album', coverIds)
    }
  } catch (error) {
    console.error(error)
  } finally {
    isLoading.value = false
  }
}

onMounted(loadAlbums)

watch(showAuthEmpty, () => {
  void loadAlbums()
})

const onAlbumCreated = () => {
  void loadAlbums()
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

    <div v-else-if="isLoading" class="p-16 text-center text-muted-foreground flex flex-col items-center gap-4">
      <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p>{{ t('pages.albums.loading') }}</p>
    </div>

    <div v-else-if="albumsData.length === 0" class="p-16 text-center text-muted-foreground flex flex-col items-center gap-4">
      <Disc class="w-12 h-12 opacity-20" />
      <p>{{ t('pages.albums.empty') }}</p>
    </div>

    <AlbumGrid v-else :albums="albumsData" />

    <CreateAlbumDialog v-model:is-open="createOpen" @success="onAlbumCreated" />
  </PageLayout>
</template>
