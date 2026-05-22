<script setup>
import { RouterLink } from 'vue-router'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import { Button } from '@/components/ui/button'
import SafeImage from '@/components/shared/SafeImage.vue'
import { playCount } from '@/lib/trackStats'
import { useHomePage } from '@/composables/useHomePage'

const {
  auth,
  visitItems,
  top20,
  topLoading,
  topError,
  visitRowClass,
  topStripRef,
  topStripBind,
  onStripMouseEnter,
  onStripMouseLeave,
  playTopFromIndex,
} = useHomePage()
</script>

<template>
  <div class="w-full space-y-10">
    <div class="space-y-2 mb-2">
      <ViewHeader
        title="홈"
        description="자주 연 페이지와 최근 일주일 인기 곡만 모았습니다."
        :show-action="false"
      />
      <div v-if="auth.isAuthenticated" class="flex justify-end">
        <RouterLink
          to="/stats"
          class="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          상세 통계
        </RouterLink>
      </div>
    </div>

    <AuthEmptyState
      v-if="!auth.isAuthenticated"
      description="로그인하면 홈이 채워집니다."
    />

    <template v-else>
      <section class="space-y-3">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          자주 찾은 항목
        </h2>
        <p class="text-xs text-muted-foreground">최근 7일 동안 자주 연 페이지만 표시합니다.</p>
        <p v-if="!visitItems.length" class="text-sm text-muted-foreground py-2">
          플레이리스트·앨범·아티스트·태그를 둘러보면 여기에 쌓입니다.
        </p>
        <ul v-else class="flex flex-col gap-2">
          <li v-for="v in visitItems" :key="`${v.type}-${v.id}`">
            <RouterLink v-if="v.to" :to="v.to" :class="visitRowClass">
              <SafeImage
                v-if="v.type !== 'tag'"
                :src="v.coverSrc"
                :type="v.imageType"
                :alt="`${v.displayName} 커버`"
                class="h-10 w-10 shrink-0 rounded-md ring-1 ring-border"
              />
              <div
                v-else
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground"
              >
                #
              </div>
              <div class="min-w-0 flex-1 text-left">
                <p class="truncate text-sm font-medium">{{ v.displayName }}</p>
                <p class="text-xs text-muted-foreground">{{ v.kindLabel }} · 최근 7일 {{ v.count }}회</p>
              </div>
            </RouterLink>
          </li>
        </ul>
      </section>

      <section class="space-y-3">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          최근 7일 많이 재생된 곡
        </h2>
        <p class="text-xs text-muted-foreground leading-relaxed">
          곡을 누르면 같은 순위의 상위 20곡이 대기열에 올라가고, 누른 곡부터 재생됩니다.
        </p>

        <div v-if="topLoading && !top20.length" class="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <div class="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          불러오는 중…
        </div>
        <div
          v-else-if="topError"
          class="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          순위 데이터를 불러오지 못했습니다.
        </div>
        <p v-else-if="!top20.length" class="text-sm text-muted-foreground py-4">아직 기록이 없습니다.</p>
        <template v-else>
          <ul class="flex flex-col gap-2 md:hidden">
            <li v-for="(track, idx) in top20.slice(0, 5)" :key="track.id">
              <button
                type="button"
                class="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                @click="playTopFromIndex(idx)"
              >
                <div class="relative h-14 w-14 shrink-0">
                  <SafeImage
                    :src="auth.coverSrc('track', track.id)"
                    type="track"
                    :alt="`${track.title} 앨범 아트`"
                    class="h-14 w-14 rounded-lg ring-1 ring-border"
                  />
                  <span
                    class="pointer-events-none absolute left-1 top-1 z-10 rounded bg-black/60 px-1 py-px text-[9px] font-bold tabular-nums text-white shadow-sm ring-1 ring-white/20 backdrop-blur-[1px]"
                  >
                    {{ playCount(track) }}회
                  </span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold">{{ track.title }}</p>
                  <p class="truncate text-xs text-muted-foreground">{{ track.artist || '—' }}</p>
                </div>
              </button>
            </li>
          </ul>

          <div
            class="hidden md:block w-[calc(100%+2rem)] max-w-none -mx-4 md:w-[calc(100%+6rem)] md:-mx-12"
          >
            <div
              ref="topStripRef"
              class="home-top-strip flex gap-3 overflow-x-auto px-4 pb-1 md:gap-4 md:px-12 cursor-grab active:cursor-grabbing touch-pan-x select-none"
              v-bind="topStripBind"
              @mouseenter="onStripMouseEnter"
              @mouseleave="onStripMouseLeave"
            >
              <button
                v-for="(track, idx) in top20"
                :key="track.id"
                type="button"
                class="flex w-[clamp(7.5rem,11vw,10.5rem)] shrink-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-[clamp(7.5rem,9vw,11rem)]"
                @click.stop="playTopFromIndex(idx)"
              >
                <div class="relative aspect-square w-full overflow-hidden bg-muted">
                  <SafeImage
                    :src="auth.coverSrc('track', track.id)"
                    type="track"
                    :alt="`${track.title} 앨범 아트`"
                    class="aspect-square h-full w-full object-cover"
                  />
                  <span
                    class="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white shadow-sm ring-1 ring-white/20 backdrop-blur-sm"
                  >
                    {{ playCount(track) }}회
                  </span>
                </div>
                <div class="space-y-0.5 p-2">
                  <p class="line-clamp-2 text-xs font-semibold leading-snug">{{ track.title }}</p>
                  <p class="line-clamp-1 text-[11px] text-muted-foreground">{{ track.artist || '—' }}</p>
                </div>
              </button>
            </div>
          </div>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped>
.home-top-strip {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.home-top-strip::-webkit-scrollbar {
  display: none;
}
.home-top-strip button {
  cursor: pointer;
}
</style>
