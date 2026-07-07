<script setup>
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import SafeImage from '@/components/shared/SafeImage.vue'

defineProps({
  artists: {
    type: Array,
    required: true,
    default: () => [],
  },
})

const auth = useAuthStore()
const { t } = useI18n()

const getArtistImageUrl = (id) => auth.coverSrc('artist', id)

const subtitleFor = (artist) => {
  const tags = artist?.topTags
  if (Array.isArray(tags) && tags.length) return tags.slice(0, 2).join(' · ')
  return t('pages.artists.cardNoTags')
}
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 pb-12">
    <RouterLink
      v-for="artist in artists"
      :key="artist.id"
      :to="{ name: 'artist-detail', params: { id: artist.id } }"
      class="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div class="relative aspect-square w-full overflow-hidden bg-muted">
        <SafeImage
          v-if="artist.cover_type"
          :src="getArtistImageUrl(artist.id)"
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
          {{ t('common.trackCount', { count: artist.trackCount || 0 }) }}
        </span>
      </div>
      <div class="space-y-0.5 p-2 min-w-0">
        <p class="text-xs font-semibold leading-snug truncate group-hover:text-primary transition-colors" :title="artist.name">
          {{ artist.name }}
        </p>
        <p class="text-[11px] leading-snug text-muted-foreground truncate" :title="subtitleFor(artist)">
          {{ subtitleFor(artist) }}
        </p>
      </div>
    </RouterLink>
  </div>
</template>
