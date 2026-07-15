<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, MoreVertical, Heart, Volume2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { splitTrailingParentheticals } from '@/lib/titleParts'
import { usePlayerPresentation } from '@/composables/usePlayerPresentation.js'
import StarRating from '@/components/shared/StarRating.vue'

const {
  currentTrack,
  isQueueView,
  canEditTrackMeta,
  library,
} = usePlayerPresentation()

const { t } = useI18n()

const albumTitleParts = computed(() =>
  splitTrailingParentheticals(currentTrack.value?.album || currentTrack.value?.albumName),
)

defineEmits(['close'])

const volumeDraft = ref(100)
let volumeSaveTimer = null

watch(
  () => currentTrack.value?.id,
  () => {
    const n = Number(currentTrack.value?.volume_pct)
    volumeDraft.value = Number.isFinite(n) ? Math.min(150, Math.max(50, Math.round(n))) : 100
  },
  { immediate: true },
)

const volumeSlider = computed({
  get: () => [volumeDraft.value],
  set: (val) => {
    const n = Array.isArray(val) ? Number(val[0]) : Number(val)
    const next = Number.isFinite(n) ? Math.min(150, Math.max(50, Math.round(n))) : 100
    volumeDraft.value = next
    scheduleVolumeSave(next)
  },
})

function scheduleVolumeSave(pct) {
  const tr = currentTrack.value
  if (!tr?.id) return
  tr.volume_pct = pct
  if (volumeSaveTimer) clearTimeout(volumeSaveTimer)
  volumeSaveTimer = setTimeout(() => {
    volumeSaveTimer = null
    void library.updateTrackVolumePct(tr.id, pct)
  }, 280)
}

async function toggleFavorite() {
  const tr = currentTrack.value
  if (tr?.id) await library.toggleTrackStar(tr.id, !tr.starred)
}

async function changeRating(rate) {
  const tr = currentTrack.value
  if (tr?.id) await library.updateTrackRating(tr.id, rate)
}

function resetVolume() {
  volumeDraft.value = 100
  scheduleVolumeSave(100)
}
</script>

<template>
  <header class="flex justify-between items-center p-6 md:px-12 shrink-0">
    <Button variant="ghost" size="icon" class="rounded-full h-12 w-12" :aria-label="t('player.close')" @click="$emit('close')">
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

    <DropdownMenu v-if="canEditTrackMeta">
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" size="icon" class="rounded-full h-12 w-12" :aria-label="t('player.moreActions')">
          <MoreVertical class="w-6 h-6" />
        </Button>
      </DropdownMenuTrigger>
      <!-- FullPlayer overlay is z-200; default dropdown z-50 sits underneath -->
      <DropdownMenuContent align="end" class="z-[250] w-64 rounded-2xl p-0 overflow-hidden">
        <DropdownMenuItem class="px-5 py-4 gap-3 font-semibold" @click="toggleFavorite">
          <Heart class="w-4 h-4 shrink-0" :class="currentTrack?.starred ? 'fill-favorite text-favorite' : ''" />
          {{ currentTrack?.starred ? t('player.favoriteRemove') : t('player.favoriteAdd') }}
        </DropdownMenuItem>
        <div class="px-5 py-4 border-t bg-muted/30" @pointerdown.stop>
          <span class="text-[10px] font-bold text-muted-foreground uppercase mb-3 block tracking-wider">{{ t('player.rating') }}</span>
          <StarRating
            :rating="currentTrack?.rating || 0"
            interactive
            size="md"
            class="w-full justify-between"
            @change="changeRating"
          />
        </div>
        <div class="px-5 py-4 border-t space-y-3" @pointerdown.stop @click.stop>
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Volume2 class="w-3.5 h-3.5" aria-hidden="true" />
              {{ t('player.trackVolume') }}
            </span>
            <div class="flex items-center gap-2">
              <span class="text-xs font-black tabular-nums">{{ volumeDraft }}%</span>
              <button
                v-if="volumeDraft !== 100"
                type="button"
                class="text-[10px] font-bold text-primary hover:underline"
                @click="resetVolume"
              >
                {{ t('player.trackVolumeReset') }}
              </button>
            </div>
          </div>
          <Slider v-model="volumeSlider" :min="50" :max="150" :step="1" class="py-1" />
          <p class="text-[10px] text-muted-foreground leading-snug">{{ t('player.trackVolumeHint') }}</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
    <div v-else class="w-12 h-12 shrink-0" aria-hidden="true" />
  </header>
</template>
