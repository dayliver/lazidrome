<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import { formatLocaleDateTime } from '@/lib/localeFormat'
import { notify } from '@/lib/notify'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import { Button } from '@/components/ui/button'
import {
  Folder,
  FolderX,
  File,
  FileAudio,
  ChevronRight,
  Home,
  RefreshCw,
  Play,
  ShieldAlert,
  Trash2,
} from 'lucide-vue-next'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const library = useLibraryStore()
const player = usePlayerStore()
const { showAuthEmpty } = useRequiresAuth()

const isLoading = ref(true)
const loadError = ref('')
const entries = ref([])
const isPlayingTrackId = ref(null)
const deletingName = ref(null)

const currentPath = computed(() => {
  const raw = route.query.path
  return typeof raw === 'string' ? raw : ''
})

const breadcrumbs = computed(() => {
  if (!currentPath.value) return []
  return currentPath.value.split('/').filter(Boolean)
})

const description = computed(() =>
  t('files.description', { count: entries.value.length }),
)

function formatBytes(bytes) {
  if (bytes == null) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  const digits = i === 0 ? 0 : 1
  return `${n.toFixed(digits)} ${units[i]}`
}

function filesQuery(path) {
  return path ? { path } : {}
}

function entryRelativePath(name) {
  return currentPath.value ? `${currentPath.value}/${name}` : name
}

function navigateTo(path) {
  router.push({ name: 'files', query: filesQuery(path) })
}

function breadcrumbHref(index) {
  const segments = breadcrumbs.value.slice(0, index + 1)
  return { name: 'files', query: filesQuery(segments.join('/')) }
}

const fetchListing = async () => {
  if (showAuthEmpty.value) {
    entries.value = []
    isLoading.value = false
    loadError.value = ''
    return
  }

  isLoading.value = true
  loadError.value = ''
  try {
    const q = new URLSearchParams()
    if (currentPath.value) q.set('path', currentPath.value)
    const url = q.toString() ? `/api/files?${q}` : '/api/files'
    const res = await auth.fetchWithAuth(url)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'fetch failed')
    }
    const body = await res.json()
    entries.value = body.entries ?? []
  } catch (err) {
    console.error(err)
    entries.value = []
    loadError.value = t('files.fetchFailed')
  } finally {
    isLoading.value = false
  }
}

const openEntry = (entry) => {
  if (entry.kind === 'directory') {
    navigateTo(entryRelativePath(entry.name))
  }
}

const playTrack = async (entry) => {
  if (!entry.trackId || isPlayingTrackId.value) return
  isPlayingTrackId.value = entry.trackId
  try {
    const tracks = await library.fetchTracksByIds([entry.trackId])
    if (tracks.length) {
      await player.playList(tracks, 0)
    }
  } catch (err) {
    console.error(err)
  } finally {
    isPlayingTrackId.value = null
  }
}

const deleteEntry = async (entry) => {
  const relPath = entryRelativePath(entry.name)
  const message =
    entry.kind === 'directory'
      ? t('files.deleteConfirmDir', { name: entry.name })
      : t('files.deleteConfirmFile', { name: entry.name })
  if (!confirm(message)) return

  deletingName.value = entry.name
  try {
    const q = new URLSearchParams({ path: relPath })
    const res = await auth.fetchWithAuth(`/api/files?${q}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'delete failed')
    }
    notify.success(t('files.deleteDone'))
    entries.value = entries.value.filter((e) => e.name !== entry.name)
    if (entry.inLibrary) {
      await library.fetchLibrary()
    }
  } catch (err) {
    console.error(err)
    notify.error(t('files.deleteFailed'))
  } finally {
    deletingName.value = null
  }
}

onMounted(fetchListing)

watch([currentPath, showAuthEmpty], () => {
  void fetchListing()
})
</script>

<template>
  <div class="container py-8 space-y-6 max-w-5xl">
    <ViewHeader :title="t('files.title')" :description="description" :show-action="false" />

    <AuthEmptyState v-if="showAuthEmpty" :message="t('files.authRequired')" />

    <template v-else>
      <nav
        class="flex flex-wrap items-center gap-1 text-sm text-muted-foreground rounded-lg border bg-muted/20 px-3 py-2"
        aria-label="breadcrumb"
      >
        <button
          type="button"
          class="inline-flex items-center gap-1 hover:text-foreground transition-colors font-medium"
          :class="{ 'text-foreground': !currentPath }"
          @click="navigateTo('')"
        >
          <Home class="w-4 h-4" />
          {{ t('files.root') }}
        </button>
        <template v-for="(segment, index) in breadcrumbs" :key="index">
          <ChevronRight class="w-4 h-4 shrink-0 opacity-50" />
          <RouterLink
            :to="breadcrumbHref(index)"
            class="hover:text-foreground transition-colors truncate max-w-[12rem]"
            :class="{ 'text-foreground font-medium': index === breadcrumbs.length - 1 }"
            :title="segment"
          >
            {{ segment }}
          </RouterLink>
        </template>
      </nav>

      <div class="flex items-center justify-between gap-3">
        <p v-if="loadError" class="text-sm text-destructive flex items-center gap-2">
          <ShieldAlert class="w-4 h-4 shrink-0" />
          {{ loadError }}
        </p>
        <div v-else class="text-sm text-muted-foreground">
          <span v-if="isLoading">{{ t('files.loading') }}</span>
        </div>
        <Button variant="outline" size="sm" :disabled="isLoading" @click="fetchListing">
          <RefreshCw class="w-4 h-4 mr-2" :class="{ 'animate-spin': isLoading }" />
          {{ t('files.refresh') }}
        </Button>
      </div>

      <div class="rounded-xl border overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-muted/40 text-muted-foreground">
            <tr>
              <th class="text-left font-medium px-4 py-3">{{ t('files.colName') }}</th>
              <th class="text-left font-medium px-4 py-3 hidden sm:table-cell">{{ t('files.colSize') }}</th>
              <th class="text-left font-medium px-4 py-3 hidden md:table-cell">{{ t('files.colModified') }}</th>
              <th class="text-right font-medium px-4 py-3 w-28">{{ t('files.colActions') }}</th>
            </tr>
          </thead>
          <tbody v-if="!isLoading && entries.length" class="divide-y">
            <tr
              v-for="entry in entries"
              :key="entry.name"
              class="hover:bg-muted/20 transition-colors"
              :class="{ 'cursor-pointer': entry.kind === 'directory' }"
              @click="entry.kind === 'directory' ? openEntry(entry) : undefined"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-3 min-w-0">
                  <FolderX
                    v-if="entry.kind === 'directory' && entry.excluded"
                    class="w-5 h-5 shrink-0 text-amber-500"
                  />
                  <Folder
                    v-else-if="entry.kind === 'directory'"
                    class="w-5 h-5 shrink-0 text-primary"
                  />
                  <FileAudio
                    v-else-if="entry.isAudio"
                    class="w-5 h-5 shrink-0 text-primary"
                  />
                  <File v-else class="w-5 h-5 shrink-0 text-muted-foreground" />

                  <span class="font-medium truncate" :title="entry.name">{{ entry.name }}</span>

                  <span
                    v-if="entry.excluded"
                    class="text-[10px] uppercase tracking-wide font-bold text-amber-600 dark:text-amber-400 shrink-0"
                  >
                    {{ t('files.excluded') }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-3 hidden sm:table-cell text-muted-foreground font-mono text-xs">
                {{ entry.kind === 'directory' ? '—' : formatBytes(entry.size) }}
              </td>
              <td class="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                {{ entry.mtime ? formatLocaleDateTime(entry.mtime, undefined, locale) : '—' }}
              </td>
              <td class="px-4 py-3" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <Button
                    v-if="entry.kind === 'file' && entry.isAudio && entry.trackId"
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8"
                    :disabled="isPlayingTrackId === entry.trackId"
                    :title="t('files.play')"
                    @click="playTrack(entry)"
                  >
                    <Play class="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8 text-destructive hover:text-destructive"
                    :disabled="deletingName === entry.name"
                    :title="t('files.delete')"
                    @click="deleteEntry(entry)"
                  >
                    <Trash2 class="w-4 h-4" :class="{ 'animate-pulse': deletingName === entry.name }" />
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
          <tbody v-else-if="!isLoading">
            <tr>
              <td colspan="4" class="px-4 py-12 text-center text-muted-foreground">
                {{ t('files.empty') }}
              </td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr>
              <td colspan="4" class="px-4 py-12 text-center text-muted-foreground">
                {{ t('files.loading') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="text-xs text-muted-foreground leading-relaxed">{{ t('files.hint') }}</p>
    </template>
  </div>
</template>
