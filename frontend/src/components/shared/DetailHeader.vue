<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, User, Disc } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { splitTrailingParentheticals } from '@/lib/titleParts'

const props = defineProps({
  title: String,
  subtitle: String,
  imageUrl: String,
  stats: Array,
  isRoundImage: {
    type: Boolean,
    default: false
  },
  /** 앨범/히어로 제목: 끝의 괄호 구간은 제거하고 덜 강조된 텍스트로 표시 (Full Player 트랙 제목과 동일 규칙) */
  splitParentheticalTitle: {
    type: Boolean,
    default: false
  }
})

const router = useRouter()
const { t } = useI18n()

const titleParts = computed(() => splitTrailingParentheticals(props.title))
</script>

<template>
  <div class="relative space-y-8 pt-10">
    <Button variant="ghost" size="icon" class="absolute top-0 left-0 rounded-full hover:bg-muted" @click="router.back()">
      <ChevronLeft class="w-8 h-8" />
    </Button>

    <div class="absolute top-0 right-0">
      <slot name="actions" />
    </div>

    <div class="flex flex-col md:flex-row items-center md:items-end gap-6 px-2 md:px-4">
      <div :class="[
        'w-48 h-48 md:w-64 md:h-64 shrink-0 bg-muted shadow-xl border border-background/10 overflow-hidden relative',
        isRoundImage ? 'rounded-full' : 'rounded-xl'
      ]">
        <!-- AlbumGrid와 동일: crossorigin + lazy, 실패 시 opacity만 조정 -->
        <img
          v-if="imageUrl"
          :key="imageUrl"
          :src="imageUrl"
          crossorigin="anonymous"
          loading="lazy"
          @error="(e) => { e.target.style.opacity = '0' }"
          class="absolute inset-0 w-full h-full object-cover z-10"
        />
        <div class="absolute inset-0 flex items-center justify-center bg-secondary z-0">
          <User v-if="isRoundImage" class="w-24 h-24 text-muted-foreground/40" />
          <Disc v-else class="w-24 h-24 text-muted-foreground/40" />
        </div>
      </div>

      <div class="flex flex-col items-center md:items-start text-center md:text-left gap-3 flex-1 min-w-0">
        <div class="space-y-1">
          <span class="text-xs font-black tracking-[0.3em] text-muted-foreground uppercase">{{ subtitle }}</span>
          <h1 class="text-3xl md:text-5xl lg:text-6xl font-black tracking-tighter leading-tight break-keep">
            <template v-if="splitParentheticalTitle && titleParts.suffix">
              {{ titleParts.main }}<span class="ms-2 md:ms-3 lg:ms-4 font-medium text-muted-foreground/90">{{ titleParts.suffix }}</span>
            </template>
            <template v-else>
              {{ title || t('detailHeader.loading') }}
            </template>
          </h1>
        </div>

        <div v-if="stats && stats.length" class="flex flex-wrap items-center justify-center md:justify-start gap-4 md:gap-6 mt-2">
          <div v-for="(stat, idx) in stats" :key="idx" class="flex flex-col">
            <span class="text-xl font-black tabular-nums">{{ stat.value }}</span>
            <span class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{{ stat.label }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
