<script setup>
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import SafeImage from '@/components/shared/SafeImage.vue'
import { formatChartListenWithPlays } from '@/lib/listenTime'
import { useHomePage } from '@/composables/useHomePage'

const { t } = useI18n()
const {
  auth,
  visitItems,
  top20,
  topArtists,
  topLoading,
  topError,
  visitStripRef,
  visitStripBind,
  topStripRef,
  topStripBind,
  topArtistsStripRef,
  topArtistsStripBind,
  onStripMouseEnter,
  onStripMouseLeave,
  playTopFromIndex,
} = useHomePage()

const homeCardClass =
  'flex w-[clamp(7.5rem,11vw,10.5rem)] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-[clamp(7.5rem,9vw,11rem)]'

/** 콘텐츠 좌측 정렬 유지, 우측 패딩·화면 밖으로 스트립 확장 */
const bleedRightClass = 'w-[calc(100%+1rem)] max-w-none -mr-4 md:w-[calc(100%+3rem)] md:-mr-12'
</script>

<template>
  <PageLayout spacing="10">
    <div class="space-y-2 mb-2">
      <ViewHeader
        :title="t('pages.home.title')"
        :description="t('pages.home.description')"
        :show-action="false"
      />
      <div v-if="auth.isAuthenticated" class="flex justify-end">
        <div class="flex gap-3 text-xs">
          <RouterLink
            to="/charts"
            class="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            {{ t('nav.charts') }}
          </RouterLink>
          <RouterLink
            to="/stats"
            class="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            {{ t('nav.stats') }}
          </RouterLink>
        </div>
      </div>
    </div>

    <AuthEmptyState
      v-if="!auth.isAuthenticated"
      :description="t('pages.home.authEmpty')"
    />

    <template v-else>
      <section class="space-y-3">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {{ t('pages.home.frequentTitle') }}
        </h2>
        <p class="text-xs text-muted-foreground">{{ t('pages.home.frequentHint') }}</p>
        <p v-if="!visitItems.length" class="text-sm text-muted-foreground py-2">
          {{ t('pages.home.frequentEmpty') }}
        </p>
        <div v-else :class="bleedRightClass">
          <div
            ref="visitStripRef"
            class="home-card-strip flex gap-3 overflow-x-auto pb-1 pr-4 md:gap-4 md:pr-12 cursor-grab active:cursor-grabbing touch-pan-x select-none"
            v-bind="visitStripBind"
          >
            <RouterLink
              v-for="v in visitItems.filter((item) => item.to)"
              :key="`${v.type}-${v.id}`"
              :to="v.to"
              :class="homeCardClass"
            >
              <div class="relative aspect-square w-full overflow-hidden bg-muted">
                <SafeImage
                  v-if="v.type !== 'tag' && v.coverSrc"
                  :src="v.coverSrc"
                  :type="v.imageType"
                  :alt="t('pages.home.coverAlt', { name: v.displayName })"
                  class="aspect-square h-full w-full object-cover"
                />
                <div
                  v-else-if="v.type === 'tag'"
                  class="flex aspect-square h-full w-full items-center justify-center bg-muted text-lg font-bold text-muted-foreground"
                >
                  #
                </div>
                <div
                  v-else
                  class="flex aspect-square h-full w-full items-center justify-center bg-secondary text-xl font-bold text-muted-foreground"
                >
                  {{ v.displayName?.[0]?.toUpperCase() || '?' }}
                </div>
                <span
                  class="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white shadow-sm ring-1 ring-white/20 backdrop-blur-sm"
                >
                  {{ t('pages.home.visitCount', { count: v.count }) }}
                </span>
              </div>
              <div class="space-y-0.5 p-2">
                <p class="text-xs font-semibold leading-snug break-words">{{ v.displayName }}</p>
                <p class="text-[11px] leading-snug text-muted-foreground break-words">{{ v.kindLabel }}</p>
              </div>
            </RouterLink>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {{ t('pages.home.topTitle') }}
        </h2>
        <p class="text-xs text-muted-foreground leading-relaxed">
          {{ t('pages.home.topHint') }}
        </p>

        <div v-if="topLoading && !top20.length" class="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <div class="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {{ t('pages.home.topLoading') }}
        </div>
        <div
          v-else-if="topError"
          class="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {{ t('pages.home.topError') }}
        </div>
        <p v-else-if="!top20.length" class="text-sm text-muted-foreground py-4">{{ t('pages.home.topEmpty') }}</p>
        <div v-else :class="bleedRightClass">
          <div
            ref="topStripRef"
            class="home-card-strip flex gap-3 overflow-x-auto pb-1 pr-4 md:gap-4 md:pr-12 cursor-grab active:cursor-grabbing touch-pan-x select-none"
            v-bind="topStripBind"
            @mouseenter="onStripMouseEnter"
            @mouseleave="onStripMouseLeave"
          >
            <button
              v-for="(track, idx) in top20"
              :key="track.id"
              type="button"
              :class="homeCardClass"
              @click.stop="playTopFromIndex(idx)"
            >
              <div class="relative aspect-square w-full overflow-hidden bg-muted">
                <SafeImage
                  :src="auth.coverSrc('track', track.id)"
                  type="track"
                  :alt="t('pages.home.albumArtAlt', { title: track.title })"
                  class="aspect-square h-full w-full object-cover"
                />
                <span
                  class="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white shadow-sm ring-1 ring-white/20 backdrop-blur-sm"
                >
                  {{ formatChartListenWithPlays(track.period_listen_sec ?? 0, track.period_plays ?? 0) }}
                </span>
              </div>
              <div class="space-y-0.5 p-2">
                <p class="text-xs font-semibold leading-snug break-words">{{ track.title }}</p>
                <p class="text-[11px] leading-snug text-muted-foreground break-words">{{ track.artist || '—' }}</p>
              </div>
            </button>
          </div>
        </div>
      </section>

      <section class="space-y-3">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {{ t('pages.home.topArtistsTitle') }}
        </h2>
        <p class="text-xs text-muted-foreground leading-relaxed">
          {{ t('pages.home.topArtistsHint') }}
        </p>

        <div v-if="topLoading && !topArtists.length" class="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <div class="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {{ t('pages.home.topLoading') }}
        </div>
        <div
          v-else-if="topError"
          class="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {{ t('pages.home.topError') }}
        </div>
        <p v-else-if="!topArtists.length" class="text-sm text-muted-foreground py-4">
          {{ t('pages.home.topArtistsEmpty') }}
        </p>
        <div v-else :class="bleedRightClass">
          <div
            ref="topArtistsStripRef"
            class="home-card-strip flex gap-3 overflow-x-auto pb-1 pr-4 md:gap-4 md:pr-12 cursor-grab active:cursor-grabbing touch-pan-x select-none"
            v-bind="topArtistsStripBind"
          >
            <RouterLink
              v-for="artist in topArtists"
              :key="artist.id"
              :to="{ name: 'artist-detail', params: { id: artist.id } }"
              :class="homeCardClass"
            >
              <div class="relative aspect-square w-full overflow-hidden bg-muted">
                <SafeImage
                  :src="auth.coverSrc('artist', artist.id)"
                  type="artist"
                  :alt="t('pages.artists.coverAlt', { name: artist.name })"
                  class="aspect-square h-full w-full object-cover"
                />
                <span
                  class="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white shadow-sm ring-1 ring-white/20 backdrop-blur-sm"
                >
                  {{ formatChartListenWithPlays(artist.period_listen_sec ?? 0, artist.period_plays ?? 0) }}
                </span>
              </div>
              <div class="space-y-0.5 p-2">
                <p class="text-xs font-semibold leading-snug break-words">{{ artist.name }}</p>
                <p class="text-[11px] leading-snug text-muted-foreground break-words">{{ t('visit.artist') }}</p>
              </div>
            </RouterLink>
          </div>
        </div>
      </section>
    </template>
  </PageLayout>
</template>

<style scoped>
.home-card-strip {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.home-card-strip::-webkit-scrollbar {
  display: none;
}
.home-card-strip button,
.home-card-strip a {
  cursor: pointer;
}
</style>
