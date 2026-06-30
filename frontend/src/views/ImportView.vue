<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useImportStore } from '@/stores/import'
import { useLibraryStore } from '@/stores/library'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import ImportTrackTable from '@/components/download/ImportTrackTable.vue'
import ImportProgress from '@/components/download/ImportProgress.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isYoutubeUrl } from '@/lib/youtubeUrl'
import { notify } from '@/lib/notify'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const importStore = useImportStore()
const library = useLibraryStore()
const { showAuthEmpty } = useRequiresAuth()

const urlInput = ref('')
const rows = ref([])
const playlistTitle = ref('')
const sourceUrl = ref('')
const ytPhase = ref('form')
const starting = ref(false)

const canSubmitYoutube = computed(
  () => rows.value.some((r) => r.selected) && !starting.value && ytPhase.value === 'form',
)

function mapResolveToRows(data) {
  playlistTitle.value = data.playlistTitle || ''
  sourceUrl.value = data.sourceUrl
  rows.value = (data.items || []).map((item, idx) => ({
    videoId: item.videoId,
    webpageUrl: item.webpageUrl,
    title: item.title || `Track ${idx + 1}`,
    artist: item.artist || '',
    album: item.album || data.playlistTitle || '',
    trackNo: item.index ?? idx + 1,
    selected: true,
  }))
}

async function resolveFromUrl(url) {
  if (!isYoutubeUrl(url)) {
    notify.error(t('download.invalidUrl'))
    return
  }
  try {
    const data = await importStore.resolveYoutube(url)
    mapResolveToRows(data)
  } catch (e) {
    notify.error(e?.message || t('download.resolveFailed'))
  }
}

async function loadFromQuery() {
  const q = String(route.query.url || '').trim()
  if (q) {
    urlInput.value = q
    await resolveFromUrl(q)
  }
}

onMounted(() => {
  importStore.reset()
  void loadFromQuery()
})

onUnmounted(() => {
  importStore.reset()
})

watch(
  () => route.query.url,
  (u) => {
    if (u && String(u) !== sourceUrl.value) {
      urlInput.value = String(u)
      void resolveFromUrl(String(u))
    }
  },
)

async function handleResolveManual() {
  const u = urlInput.value.trim()
  if (!u) return
  await router.replace({ name: 'import', query: { url: u } })
  await resolveFromUrl(u)
}

async function handleStartYoutube() {
  if (!canSubmitYoutube.value) return
  starting.value = true
  ytPhase.value = 'running'
  try {
    const payload = rows.value
      .filter((r) => r.selected)
      .map((r) => ({
        videoId: r.videoId,
        webpageUrl: r.webpageUrl,
        title: r.title,
        artist: r.artist,
        album: r.album,
        trackNo: r.trackNo,
        selected: true,
      }))
    const id = await importStore.startImport(sourceUrl.value, payload)
    await importStore.fetchJobStatus(id)
    await importStore.pollJobUntilDone(id)
    ytPhase.value = 'done'
    await library.fetchLibrary({ force: true })
    notify.success(t('download.completed'))
  } catch (e) {
    ytPhase.value = 'form'
    notify.error(e?.message || t('download.startFailed'))
  } finally {
    starting.value = false
  }
}

function resetYoutube() {
  rows.value = []
  ytPhase.value = 'form'
  sourceUrl.value = ''
  urlInput.value = ''
}
</script>

<template>
  <PageLayout>
    <ViewHeader
      :title="t('import.title')"
      :description="t('import.subtitle')"
      :show-action="false"
    />

    <AuthEmptyState v-if="showAuthEmpty" :description="t('import.authRequired')" />

    <template v-else>
      <div class="space-y-3 rounded-xl border p-4">
        <Label for="yt-url">{{ t('download.urlLabel') }}</Label>
        <div class="flex gap-2">
          <Input
            id="yt-url"
            v-model="urlInput"
            :placeholder="t('download.urlPlaceholder')"
            class="font-mono text-sm"
            @keyup.enter="handleResolveManual"
          />
          <Button
            type="button"
            variant="secondary"
            :disabled="importStore.resolving"
            @click="handleResolveManual"
          >
            {{ importStore.resolving ? t('download.resolving') : t('download.resolve') }}
          </Button>
        </div>
        <p class="text-xs text-muted-foreground">{{ t('download.pasteHint') }}</p>
      </div>

      <div v-if="importStore.resolving" class="py-12 text-center text-muted-foreground text-sm">
        {{ t('download.resolving') }}
      </div>

      <template v-else-if="rows.length">
        <ImportTrackTable
          v-if="ytPhase === 'form'"
          v-model:rows="rows"
          :playlist-title="playlistTitle"
        />

        <ImportProgress
          v-if="ytPhase === 'running' || ytPhase === 'done'"
          :status="importStore.jobStatus"
        />

        <div v-if="ytPhase === 'form'" class="flex justify-end gap-2">
          <Button type="button" :disabled="!canSubmitYoutube" @click="handleStartYoutube">
            {{ t('download.start', { count: rows.filter((r) => r.selected).length }) }}
          </Button>
        </div>

        <div v-if="ytPhase === 'done'" class="flex gap-2">
          <Button type="button" variant="outline" as-child>
            <RouterLink to="/tracks">{{ t('download.goTracks') }}</RouterLink>
          </Button>
          <Button type="button" variant="secondary" @click="resetYoutube">
            {{ t('download.importAnother') }}
          </Button>
        </div>
      </template>

      <p class="text-xs text-muted-foreground text-center">
        {{ t('import.uploadHint') }}
        <RouterLink to="/upload" class="text-primary underline-offset-4 hover:underline">
          {{ t('import.uploadLink') }}
        </RouterLink>
      </p>
    </template>
  </PageLayout>
</template>
