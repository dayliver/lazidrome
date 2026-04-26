<script setup>
import { ChevronDown, MoreVertical, Heart, Star } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

defineProps({
  player: { type: Object, required: true },
  currentTrack: { type: Object, default: null },
  showMenu: { type: Boolean, required: true },
  toggleFavorite: { type: Function, required: true },
  changeRating: { type: Function, required: true }
})

defineEmits(['close', 'toggle-menu'])
</script>

<template>
  <header class="flex justify-between items-center p-6 md:px-12 shrink-0">
    <Button variant="ghost" size="icon" class="rounded-full h-12 w-12" @click="$emit('close')">
      <ChevronDown class="w-8 h-8" />
    </Button>
    <div class="flex flex-col items-center flex-1 px-4 text-center">
      <span class="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">
        {{ player.isQueueView ? 'Up Next' : 'Now Playing' }}
      </span>
      <span class="text-sm font-bold truncate max-w-[250px]">{{ currentTrack?.albumName || 'Lazidrome' }}</span>
    </div>

    <div class="relative">
      <Button variant="ghost" size="icon" class="rounded-full h-12 w-12" @click="$emit('toggle-menu')">
        <MoreVertical class="w-6 h-6" />
      </Button>
      <div v-if="showMenu" class="absolute right-0 top-full mt-2 w-56 bg-card border rounded-2xl shadow-2xl overflow-hidden z-[130]">
        <button @click="toggleFavorite" class="w-full text-left px-5 py-4 text-sm font-semibold hover:bg-muted flex items-center gap-3">
          <Heart :class="currentTrack?.starred ? 'fill-red-500 text-red-500' : ''" class="w-4 h-4" />
          좋아요 {{ currentTrack?.starred ? '취소' : '추가' }}
        </button>
        <div class="px-5 py-4 border-t bg-muted/30">
          <span class="text-[10px] font-bold text-muted-foreground uppercase mb-3 block tracking-wider">평점 설정</span>
          <div class="flex justify-between">
            <button v-for="i in 5" :key="i" @click="changeRating(i)">
              <Star class="w-6 h-6 transition-all active:scale-125" :class="i <= (currentTrack?.rating || 0) ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground/30'" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
