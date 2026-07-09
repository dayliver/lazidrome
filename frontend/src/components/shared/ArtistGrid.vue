<script setup>
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import SafeImage from '@/components/shared/SafeImage.vue'
import VirtualScrollGrid from '@/components/shared/VirtualScrollGrid.vue'

defineProps({
  artists: {
    type: Array,
    required: true,
    default: () => [],
  },
})

const { t } = useI18n()

const subtitleFor = (artist) => {
  const tags = artist?.topTags
  if (Array.isArray(tags) && tags.length) return tags.slice(0, 2).join(' · ')
  return t('pages.artists.cardNoTags')
}
</script>

<template>
  <VirtualScrollGrid :items="artists" :row-height="280" class="pb-12">
    <template #item="{ item: artist }">
      <RouterLink
        :to="{ name: 'artist-detail', params: { id: artist.id } }"
        class="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div class="relative aspect-square w-full overflow-hidden bg-muted">
          <SafeImage
            v-if="artist.cover_type"
            sign-type="artist"
            :sign-id="artist.id"
            type="artist"
            :alt="t('pages.artists.coverAlt', { name: artist.name })"
            class="aspect-square h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div
            v-else
            class="flex aspect-square h-full w-full items-center justify-center bg-secondary text-2xl font-bold text-muted-foreground"
          >
            {{ artist.name?.[0]?.toUpperCase() || '?' }}
          </div>
          <span
            class="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white shadow-sm ring-1 ring-white/20 backdrop-blur-sm"
          >
            {{ artist.trackCount ?? 0 }}
          </span>
        </div>
        <div class="flex min-w-0 flex-col gap-1 p-3">
          <span class="truncate font-bold leading-tight group-hover:text-primary">{{ artist.name }}</span>
          <span class="truncate text-xs text-muted-foreground">{{ subtitleFor(artist) }}</span>
        </div>
      </RouterLink>
    </template>
  </VirtualScrollGrid>
</template>
