<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X, ListMusic, Plus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

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
    toast.warning('추가할 곡이 없습니다.')
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
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
    <div class="bg-card w-full max-w-sm md:max-w-md rounded-2xl shadow-2xl border flex flex-col overflow-hidden max-h-[80vh]">

      <header class="flex items-center justify-between px-6 py-4 border-b bg-muted/20 shrink-0">
        <h2 class="text-lg font-black flex items-center gap-2">
          <ListMusic class="w-5 h-5 text-primary" /> 플레이리스트에 추가
        </h2>
        <Button variant="ghost" size="icon" @click="handleClose" :disabled="isSubmitting" class="h-8 w-8 rounded-full focus:outline-none">
          <X class="w-4 h-4" />
        </Button>
      </header>

      <div class="p-4 border-b bg-muted/5 shrink-0">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            placeholder="플레이리스트 검색..."
            class="pl-9 font-medium bg-background focus-visible:ring-primary"
            :disabled="isSubmitting"
          />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-2 custom-scrollbar relative">
        <div v-if="isSubmitting" class="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <div class="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
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
              <span class="text-[11px] text-muted-foreground truncate">{{ pl.description || '수동 플레이리스트' }}</span>
            </div>

            <div class="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus class="w-5 h-5 text-primary" />
            </div>
          </button>
        </div>

        <div v-else-if="searchQuery" class="p-8 text-center text-muted-foreground">
          <p class="text-sm font-medium">검색된 플레이리스트가 없습니다.</p>
        </div>

        <div v-else class="p-8 flex flex-col items-center justify-center text-center">
          <ListMusic class="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p class="text-sm font-bold text-foreground">수동 플레이리스트가 없습니다.</p>
          <p class="text-xs text-muted-foreground mt-1 mb-4">먼저 메뉴에서 새 플레이리스트를<br/>만들어주세요.</p>
        </div>
      </div>

      <footer class="p-3 border-t bg-muted/10 shrink-0 text-center flex items-center justify-center gap-1">
        <span class="text-xs font-black text-primary">{{ trackIds.length }}곡</span>
        <span class="text-xs font-medium text-muted-foreground">추가 예정</span>
      </footer>

    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--muted)); border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.4); }
</style>
