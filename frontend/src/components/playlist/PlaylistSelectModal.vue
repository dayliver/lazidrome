<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlaylistStore } from '@/stores/playlist'
import AppEditShell from '@/components/shared/AppEditShell.vue'
import { Input } from '@/components/ui/input'
import { Search, ListMusic, Plus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
const { t } = useI18n()

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  trackIds: { type: Array, required: true, default: () => [] }
})

const emit = defineEmits(['update:isOpen', 'success'])

const playlistStore = usePlaylistStore()
const searchQuery = ref('')
const isSubmitting = ref(false)

onMounted(async () => {
  if (playlistStore.playlists.length === 0) {
    await playlistStore.fetchPlaylists()
  }
})

const filteredPlaylists = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const manuals = playlistStore.manualPlaylists || []

  if (!query) return manuals
  return manuals.filter(pl => pl.name.toLowerCase().includes(query))
})

const handleClose = () => {
  searchQuery.value = ''
  emit('update:isOpen', false)
}

const handleSelect = async (playlistId) => {
  if (props.trackIds.length === 0) {
    toast.warning(t('playlist.noTracksToAdd'))
    return
  }

  isSubmitting.value = true
  try {
    const success = await playlistStore.addTracksToPlaylist(playlistId, props.trackIds)
    if (success) {
      emit('success')
      handleClose()
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <AppEditShell
    :open="isOpen"
    :title="t('playlist.selectModalTitle')"
    :show-close="!isSubmitting"
    panel-class="bg-card flex h-full w-full flex-col overflow-hidden sm:h-auto sm:max-h-[80dvh] sm:max-w-md sm:rounded-2xl sm:border sm:shadow-2xl"
    teleport
    @close="!isSubmitting && handleClose()"
  >
    <div class="sticky -top-4 z-20 border-b bg-card pb-3 sm:-top-8">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          v-model="searchQuery"
          :placeholder="t('playlist.selectSearchPlaceholder')"
          class="h-11 pl-9 text-base font-medium bg-background focus-visible:ring-primary"
          :disabled="isSubmitting"
        />
      </div>
    </div>

    <div class="py-2 relative">
      <div v-if="isSubmitting" class="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
        <span class="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      </div>

      <div v-if="filteredPlaylists.length > 0" class="space-y-1">
        <button
          v-for="pl in filteredPlaylists"
          :key="pl.id"
          @click="handleSelect(pl.id)"
          :disabled="isSubmitting"
          class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted active:bg-muted/80 transition-colors text-left group disabled:opacity-50 focus:outline-none focus:bg-muted"
        >
          <div class="w-10 h-10 rounded-md bg-secondary border shadow-sm flex items-center justify-center shrink-0">
            <ListMusic class="w-5 h-5 text-muted-foreground/50" />
          </div>

          <div class="flex flex-col min-w-0 flex-1">
            <span class="font-bold text-sm truncate group-hover:text-primary transition-colors">{{ pl.name }}</span>
            <span class="text-[11px] text-muted-foreground truncate">{{ pl.description || t('pages.details.playlistManual') }}</span>
          </div>

          <div class="shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100 transition-opacity">
            <Plus class="w-5 h-5 text-primary" />
          </div>
        </button>
      </div>

      <div v-else-if="searchQuery" class="p-8 text-center text-muted-foreground">
        <p class="text-sm font-medium">{{ t('playlist.noSearchPlaylists') }}</p>
      </div>

      <div v-else class="p-8 flex flex-col items-center justify-center text-center">
        <ListMusic class="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p class="text-sm font-bold text-foreground">{{ t('playlist.noManualPlaylists') }}</p>
        <p class="text-xs text-muted-foreground mt-1 mb-4">{{ t('playlist.createPlaylistHint') }}</p>
      </div>
    </div>

    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-center gap-1">
        <span class="text-xs font-black text-primary">{{ t('common.trackCount', { count: trackIds.length }) }}</span>
        <span class="text-xs font-medium text-muted-foreground">{{ t('playlist.tracksPendingAdd') }}</span>
      </div>
    </template>
  </AppEditShell>
</template>
