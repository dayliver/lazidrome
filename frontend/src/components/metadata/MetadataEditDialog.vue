<script setup>
import { ref, computed, defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { useMetadataEditStore } from '@/stores/metadataEdit'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { X, Save, Trash2, Info, Users, Image as ImageIcon, Globe, ListMusic } from 'lucide-vue-next'

const TrackMetadataPanel = defineAsyncComponent(() => import('./TrackMetadataPanel.vue'))
const AlbumMetadataPanel = defineAsyncComponent(() => import('./AlbumMetadataPanel.vue'))
const ArtistMetadataPanel = defineAsyncComponent(() => import('./ArtistMetadataPanel.vue'))

const library = useLibraryStore()
const metadataEdit = useMetadataEditStore()
const router = useRouter()
const route = useRoute()
const item = computed(() => metadataEdit.currentItem)
const activeTab = ref('basic')
const wrapperRef = ref(null)
const isDeleting = ref(false)

const wrapperMap = { track: TrackMetadataPanel, album: AlbumMetadataPanel, artist: ArtistMetadataPanel }
const currentWrapper = computed(() => (item.value ? wrapperMap[item.value.type] : null))
const { t } = useI18n()

const canDeleteEntity = computed(
  () => item.value?.type === 'album' || item.value?.type === 'artist',
)

const tabs = computed(() => {
  if (!item.value) return []
  const baseTabs = [{ id: 'basic', label: t('metadata.tabBasic'), icon: Info }]

  if (item.value.type === 'track') {
    baseTabs.push({ id: 'artists', label: t('metadata.tabArtists'), icon: Users })
  } else if (item.value.type === 'album') {
    baseTabs.push({ id: 'albumArtists', label: t('metadata.tabAlbumArtists'), icon: Users })
    baseTabs.push({ id: 'tracks', label: t('metadata.tabTracks'), icon: ListMusic })
  }

  baseTabs.push({
    id: 'cover',
    label: item.value.type === 'artist' ? t('metadata.tabProfile') : t('metadata.tabCover'),
    icon: ImageIcon,
  })
  baseTabs.push({ id: 'external', label: t('metadata.tabExternal'), icon: Globe })
  return baseTabs
})

const handleSave = async () => {
  const formData = wrapperRef.value?.getPayload()
  if (!formData) return

  const updatedData = await metadataEdit.saveMetadata(item.value, formData)

  if (updatedData) {
    if (item.value.type === 'artist') {
      library.updateLocalArtist(updatedData)
    } else if (item.value.type === 'album') {
      library.updateLocalAlbum(updatedData)
    } else if (item.value.type === 'track') {
      library.updateLocalTrack(updatedData)
    }

    metadataEdit.shiftQueue()
  }
}

const handleDelete = async () => {
  const current = item.value
  if (!current || !canDeleteEntity.value || isDeleting.value) return

  const name = current.local?.name || ''
  const trackCount = Number(current.local?.trackCount) || 0

  if (current.type === 'album' && trackCount > 0) {
    toast.warning(t('metadata.cannotDeleteHasTracks', { count: trackCount }))
    return
  }

  if (current.type === 'artist') {
    if (trackCount > 0) {
      if (!confirm(t('metadata.deleteConfirmArtistWithTracks', { name, count: trackCount }))) return
      if (!confirm(t('metadata.deleteConfirmArtistFinal', { name, count: trackCount }))) return
    } else if (!confirm(t('metadata.deleteConfirmArtist', { name }))) {
      return
    }
  } else if (!confirm(t('metadata.deleteConfirmAlbum', { name }))) {
    return
  }

  isDeleting.value = true
  try {
    const result = await metadataEdit.deleteEntity(current)
    if (result.reason === 'HAS_TRACKS') {
      toast.warning(t('metadata.cannotDeleteHasTracks', { count: result.trackCount || 0 }))
      return
    }
    if (!result.ok) {
      toast.error(t('metadata.deleteFailed'))
      return
    }

    const unlinked = Number(result.data?.unlinkedTracks) || 0
    if (current.type === 'artist' && unlinked > 0) {
      toast.success(t('metadata.deletedArtistWithTracks', { count: unlinked }))
    } else {
      toast.success(t('metadata.deleted'))
    }
    metadataEdit.clearQueue()
    await library.fetchLibrary({ force: true })

    const id = current.id
    if (current.type === 'artist' && route.name === 'artist-detail' && route.params.id === id) {
      await router.replace({ name: 'artists' })
    } else if (current.type === 'album' && route.name === 'album-detail' && route.params.id === id) {
      await router.replace({ name: 'albums' })
    }
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div
    v-if="item"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
  >
    <div class="bg-card w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl border-2 flex flex-col overflow-hidden">
      <header class="flex items-center justify-between px-8 py-5 border-b bg-muted/20">
        <h2 class="text-2xl font-black">{{ t('metadata.editTitle') }}</h2>
        <Button variant="ghost" size="icon" @click="metadataEdit.shiftQueue()"><X /></Button>
      </header>

      <nav class="flex items-center border-b px-8 gap-8 bg-muted/5 shrink-0 overflow-x-auto no-scrollbar">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="flex items-center gap-2 py-4 text-sm font-black border-b-2 transition-all whitespace-nowrap focus:outline-none"
          :class="
            activeTab === tab.id
              ? 'border-primary text-primary translate-y-[1px]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
        >
          <component :is="tab.icon" class="w-4 h-4" />
          {{ tab.label }}
        </button>
      </nav>

      <main class="flex-1 overflow-y-auto p-8 relative">
        <component
          :is="currentWrapper"
          ref="wrapperRef"
          :item="item"
          :active-tab="activeTab"
          @update:active-tab="activeTab = $event"
        />
      </main>

      <footer class="p-6 border-t bg-muted/20 flex items-center justify-between gap-3">
        <Button
          v-if="canDeleteEntity"
          variant="destructive"
          :disabled="isDeleting || metadataEdit.isFetching"
          @click="handleDelete"
        >
          <Trash2 class="w-4 h-4 mr-2" />
          {{ t('metadata.delete') }}
        </Button>
        <div v-else />
        <Button @click="handleSave" class="font-black px-12" :disabled="isDeleting">
          <Save class="w-4 h-4 mr-2" /> {{ t('common.save') }}
        </Button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
