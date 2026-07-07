<script setup>
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { X, Loader2 } from 'lucide-vue-next'
import { useGlobalSearch } from '@/composables/useGlobalSearch'
import SafeImage from '@/components/shared/SafeImage.vue'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'

const emit = defineEmits(['navigate'])

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const { query, open, loading, results, clear, hasAnyResults, showPanel } = useGlobalSearch()

const empty = () => !loading.value && showPanel.value && !hasAnyResults.value

function close() {
  open.value = false
}

function go(routeLocation) {
  clear()
  emit('navigate')
  void router.push(routeLocation)
}

function goArtist(id) {
  go({ name: 'artist-detail', params: { id } })
}
function goAlbum(id) {
  go({ name: 'album-detail', params: { id } })
}
function goTrack(id) {
  go({ name: 'track-detail', params: { id } })
}
</script>

<template>
  <Transition name="search-panel">
    <aside
      v-if="showPanel"
      class="fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col border-l bg-card shadow-2xl md:top-0"
    >
      <div class="flex items-center justify-between gap-2 border-b px-4 py-3">
        <div class="min-w-0">
          <p class="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {{ t('nav.searchResults') }}
          </p>
          <p class="truncate text-sm font-semibold">"{{ query }}"</p>
        </div>
        <Button variant="ghost" size="icon" class="shrink-0" @click="close">
          <X class="h-5 w-5" />
        </Button>
      </div>

      <div class="flex-1 overflow-y-auto p-2">
        <div v-if="loading" class="flex items-center gap-2 px-3 py-8 text-sm text-muted-foreground">
          <Loader2 class="h-4 w-4 animate-spin shrink-0" />
          {{ t('nav.searchLoading') }}
        </div>
        <p v-else-if="empty()" class="px-3 py-8 text-sm text-muted-foreground text-center">
          {{ t('nav.searchEmpty') }}
        </p>
        <template v-else>
          <section v-if="results.artists.length" class="py-1">
            <p class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {{ t('nav.artists') }}
            </p>
            <button
              v-for="item in results.artists"
              :key="`a-${item.id}`"
              type="button"
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted/60"
              @click="goArtist(item.id)"
            >
              <SafeImage
                :src="auth.coverSrc('artist', item.id)"
                type="artist"
                :alt="item.name"
                class="h-10 w-10 shrink-0 rounded-full object-cover"
              />
              <span class="truncate font-medium">{{ item.name }}</span>
            </button>
          </section>

          <section v-if="results.albums.length" class="border-t border-border/60 py-1">
            <p class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {{ t('nav.albums') }}
            </p>
            <button
              v-for="item in results.albums"
              :key="`al-${item.id}`"
              type="button"
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted/60"
              @click="goAlbum(item.id)"
            >
              <SafeImage
                v-if="item.cover_type"
                :src="auth.coverSrc('album', item.id)"
                type="album"
                :alt="item.name"
                class="h-10 w-10 shrink-0 rounded-md object-cover"
              />
              <div
                v-else
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-bold"
              >
                {{ item.name?.[0] || '?' }}
              </div>
              <div class="min-w-0">
                <p class="truncate font-medium">{{ item.name }}</p>
                <p class="truncate text-xs text-muted-foreground">{{ item.displayArtist || '—' }}</p>
              </div>
            </button>
          </section>

          <section v-if="results.tracks.length" class="border-t border-border/60 py-1">
            <p class="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {{ t('nav.tracks') }}
            </p>
            <button
              v-for="item in results.tracks"
              :key="`t-${item.id}`"
              type="button"
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted/60"
              @click="goTrack(item.id)"
            >
              <SafeImage
                :src="auth.coverSrc('track', item.id)"
                type="track"
                :alt="item.title"
                class="h-10 w-10 shrink-0 rounded-md object-cover"
              />
              <div class="min-w-0">
                <p class="truncate font-medium">{{ item.title }}</p>
                <p class="truncate text-xs text-muted-foreground">{{ item.artist || '—' }}</p>
              </div>
            </button>
          </section>
        </template>
      </div>
    </aside>
  </Transition>

  <Transition name="fade">
    <button
      v-if="showPanel"
      type="button"
      class="fixed inset-0 z-[65] bg-background/50 backdrop-blur-[1px] md:left-[17rem]"
      aria-label="close search"
      @click="close"
    />
  </Transition>
</template>

<style scoped>
.search-panel-enter-active,
.search-panel-leave-active {
  transition: transform 0.25s ease, opacity 0.2s ease;
}
.search-panel-enter-from,
.search-panel-leave-to {
  transform: translateX(100%);
  opacity: 0.6;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
