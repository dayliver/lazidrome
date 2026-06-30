<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, MoreVertical, Heart, Star } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { splitTrailingParentheticals } from '@/lib/titleParts'
import { usePlayerPresentation } from '@/composables/usePlayerPresentation.js'

const {
  currentTrack,
  isQueueView,
  canEditTrackMeta,
  library,
} = usePlayerPresentation()

const { t } = useI18n()
const showMenu = ref(false)

const albumTitleParts = computed(() =>
  splitTrailingParentheticals(currentTrack.value?.album || currentTrack.value?.albumName),
)

defineEmits(['close'])

async function toggleFavorite() {
  const tr = currentTrack.value
  if (tr?.id) await library.toggleTrackStar(tr.id, !tr.starred)
  showMenu.value = false
}

async function changeRating(rate) {
  const tr = currentTrack.value
  if (tr?.id) await library.updateTrackRating(tr.id, rate)
  showMenu.value = false
}
</script>

<template>
  <header class="flex justify-between items-center p-6 md:px-12 shrink-0">
    <Button variant="ghost" size="icon" class="rounded-full h-12 w-12" @click="$emit('close')">
      <ChevronDown class="w-8 h-8" />
    </Button>
    <div class="flex flex-col items-center flex-1 px-4 text-center">
      <span class="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">
        {{ isQueueView ? t('player.queue') : t('player.nowPlaying') }}
      </span>
      <span class="text-sm font-bold truncate max-w-[250px]">
        <template v-if="albumTitleParts.suffix">
          {{ albumTitleParts.main }}<span class="ms-1.5 font-semibold text-muted-foreground/90">{{ albumTitleParts.suffix }}</span>
        </template>
        <template v-else>{{ currentTrack?.album || currentTrack?.albumName || t('app.name') }}</template>
      </span>
    </div>

    <div v-if="canEditTrackMeta" class="relative">
      <Button variant="ghost" size="icon" class="rounded-full h-12 w-12" @click="showMenu = !showMenu">
        <MoreVertical class="w-6 h-6" />
      </Button>
      <div v-if="showMenu" class="absolute right-0 top-full mt-2 w-56 bg-card border rounded-2xl shadow-2xl overflow-hidden z-[130]">
        <button @click="toggleFavorite" class="w-full text-left px-5 py-4 text-sm font-semibold hover:bg-muted flex items-center gap-3">
          <Heart :class="currentTrack?.starred ? 'fill-red-500 text-red-500' : ''" class="w-4 h-4" />
          {{ currentTrack?.starred ? t('player.favoriteRemove') : t('player.favoriteAdd') }}
        </button>
        <div class="px-5 py-4 border-t bg-muted/30">
          <span class="text-[10px] font-bold text-muted-foreground uppercase mb-3 block tracking-wider">{{ t('player.rating') }}</span>
          <div class="flex justify-between">
            <button v-for="i in 5" :key="i" @click="changeRating(i)">
              <Star class="w-6 h-6 transition-all active:scale-125" :class="i <= (currentTrack?.rating || 0) ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground/30'" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="w-12 h-12 shrink-0" aria-hidden="true" />
  </header>
</template>
