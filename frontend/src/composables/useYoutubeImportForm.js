import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImportStore } from '@/stores/import'
import { useLibraryStore } from '@/stores/library'
import { isYoutubeUrl } from '@/lib/youtubeUrl'
import { notify } from '@/lib/notify'

/**
 * Shared YouTube import form state for ImportView (and similar surfaces).
 */
export function useYoutubeImportForm() {
  const { t } = useI18n()
  const importStore = useImportStore()
  const library = useLibraryStore()

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
      notify.error(t('import.invalidUrl'))
      return
    }
    try {
      const data = await importStore.resolveYoutube(url)
      mapResolveToRows(data)
    } catch (e) {
      notify.error(e?.message || t('import.resolveFailed'))
    }
  }

  async function startYoutubeImport() {
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
      notify.success(t('import.completed'))
    } catch (e) {
      ytPhase.value = 'form'
      notify.error(e?.message || t('import.startFailed'))
    } finally {
      starting.value = false
    }
  }

  function resetYoutube() {
    rows.value = []
    ytPhase.value = 'form'
    sourceUrl.value = ''
    urlInput.value = ''
    importStore.reset()
  }

  return {
    importStore,
    urlInput,
    rows,
    playlistTitle,
    sourceUrl,
    ytPhase,
    starting,
    canSubmitYoutube,
    resolveFromUrl,
    startYoutubeImport,
    resetYoutube,
  }
}
