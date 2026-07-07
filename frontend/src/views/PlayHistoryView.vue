<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { History } from 'lucide-vue-next'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import SafeImage from '@/components/shared/SafeImage.vue'
import { Button } from '@/components/ui/button'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'
import { usePreferencesStore } from '@/stores/preferences'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import { formatLocaleDateTime } from '@/lib/localeFormat'

const PAGE_SIZE = 50

const { t, locale } = useI18n()
const library = useLibraryStore()
const auth = useAuthStore()
const prefs = usePreferencesStore()
const { showAuthEmpty } = useRequiresAuth()

const items = ref([])
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref(null)

const hasMore = computed(() => items.value.length < total.value)

const dateTimeOptions = computed(() => ({
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: prefs.effectiveTimezone,
}))

const formatPlayedAt = (iso) => formatLocaleDateTime(iso, dateTimeOptions.value, locale.value)

const trackCoverSrc = (row) => {
  if (!row?.track_id) return ''
  if (row.custom_cover_type || row.album_cover_type) {
    return auth.coverSrc('track', row.track_id)
  }
  return ''
}

const loadInitial = async () => {
  if (!auth.isAuthenticated) {
    items.value = []
    total.value = 0
    return
  }
  loading.value = true
  error.value = null
  try {
    const data = await library.fetchPlayHistory({ limit: PAGE_SIZE, offset: 0 })
    items.value = data?.items ?? []
    total.value = data?.total ?? 0
  } catch (e) {
    console.error(e)
    error.value = e
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const loadMore = async () => {
  if (!hasMore.value || loadingMore.value || loading.value) return
  loadingMore.value = true
  try {
    const data = await library.fetchPlayHistory({
      limit: PAGE_SIZE,
      offset: items.value.length,
    })
    const next = data?.items ?? []
    items.value = [...items.value, ...next]
    total.value = data?.total ?? total.value
  } catch (e) {
    console.error(e)
    error.value = e
  } finally {
    loadingMore.value = false
  }
}

onMounted(loadInitial)
watch(
  () => auth.token,
  () => {
    void loadInitial()
  },
)
</script>

<template>
  <PageLayout spacing="8">
    <ViewHeader
      :title="t('history.title')"
      :description="t('history.description')"
      :show-action="false"
    />

    <AuthEmptyState
      v-if="showAuthEmpty"
      :description="t('history.authEmpty')"
    />

    <template v-else>
      <div v-if="loading && !items.length" class="py-16 text-center text-muted-foreground">
        <div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        {{ t('history.loading') }}
      </div>

      <div
        v-else-if="error && !items.length"
        class="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        {{ t('history.error') }}
      </div>

      <div
        v-else-if="!items.length"
        class="py-16 text-center text-muted-foreground flex flex-col items-center gap-3 border-2 border-dashed rounded-2xl"
      >
        <History class="w-12 h-12 opacity-25" />
        <p class="font-semibold text-foreground">{{ t('history.empty') }}</p>
        <p class="text-sm">{{ t('history.emptyHint') }}</p>
      </div>

      <template v-else>
        <p class="text-xs text-muted-foreground px-1">
          {{ t('history.shown', { shown: items.length, total }) }}
        </p>

        <ul class="divide-y border rounded-xl bg-card overflow-hidden">
          <li
            v-for="row in items"
            :key="row.id"
            class="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 hover:bg-muted/40 transition-colors"
          >
            <time
              class="shrink-0 w-[9.5rem] sm:w-[11rem] text-[11px] sm:text-xs tabular-nums text-muted-foreground leading-snug"
              :datetime="row.played_at"
            >
              {{ formatPlayedAt(row.played_at) }}
            </time>

            <RouterLink
              :to="{ name: 'track-detail', params: { id: row.track_id } }"
              class="flex min-w-0 flex-1 items-center gap-3 group"
            >
              <div class="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                <SafeImage
                  v-if="trackCoverSrc(row)"
                  :src="trackCoverSrc(row)"
                  type="track"
                  :alt="row.title"
                  class="h-full w-full object-cover"
                />
                <div
                  v-else
                  class="flex h-full w-full items-center justify-center text-xs font-bold text-muted-foreground"
                >
                  {{ row.title?.[0]?.toUpperCase() || '?' }}
                </div>
              </div>

              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold leading-snug truncate group-hover:text-primary transition-colors">
                  {{ row.title }}
                </p>
                <p class="text-xs text-muted-foreground truncate">
                  {{ row.artist || t('common.unknownArtist') }}
                </p>
              </div>
            </RouterLink>

            <span
              class="shrink-0 min-w-[3.25rem] text-right text-[11px] sm:text-xs font-semibold tabular-nums text-muted-foreground"
            >
              {{ t('history.playNumber', { n: row.play_number ?? '?' }) }}
            </span>

            <span
              v-if="row.scrobbled"
              class="hidden sm:inline shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
              :title="t('history.scrobbled')"
            >
              {{ t('history.scrobbled') }}
            </span>
          </li>
        </ul>

        <div class="flex justify-center pt-2">
          <Button
            v-if="hasMore"
            variant="outline"
            class="rounded-full px-6"
            :disabled="loadingMore"
            @click="loadMore"
          >
            {{ loadingMore ? t('history.loadingMore') : t('history.loadMore') }}
          </Button>
          <p v-else class="text-xs text-muted-foreground py-2">
            {{ t('history.allLoaded') }}
          </p>
        </div>
      </template>
    </template>
  </PageLayout>
</template>
