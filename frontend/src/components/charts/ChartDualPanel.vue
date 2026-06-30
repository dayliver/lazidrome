<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const mobileTab = ref('tracks')
</script>

<template>
  <div class="space-y-4">
    <!-- 모바일: 탭으로 전환 -->
    <div class="flex gap-1 p-1 rounded-lg bg-muted/60 md:hidden">
      <button
        type="button"
        class="flex-1 px-3 py-1.5 text-sm rounded-md transition-colors"
        :class="mobileTab === 'tracks' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'"
        @click="mobileTab = 'tracks'"
      >
        {{ t('charts.tabTracks') }}
      </button>
      <button
        type="button"
        class="flex-1 px-3 py-1.5 text-sm rounded-md transition-colors"
        :class="mobileTab === 'artists' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'"
        @click="mobileTab = 'artists'"
      >
        {{ t('charts.tabArtists') }}
      </button>
    </div>

    <!-- 데스크톱: 2열 / 모바일: 활성 탭만 -->
    <div class="md:grid md:grid-cols-2 md:gap-8 md:items-start">
      <div
        class="min-w-0 flex flex-col gap-3"
        :class="mobileTab === 'tracks' ? 'block' : 'hidden md:flex'"
      >
        <h3 class="hidden md:block text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
          {{ t('charts.tabTracks') }}
        </h3>
        <slot name="tracks" />
      </div>

      <div
        class="min-w-0 flex flex-col gap-3"
        :class="mobileTab === 'artists' ? 'block' : 'hidden md:flex'"
      >
        <h3 class="hidden md:block text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
          {{ t('charts.tabArtists') }}
        </h3>
        <slot name="artists" />
      </div>
    </div>
  </div>
</template>
