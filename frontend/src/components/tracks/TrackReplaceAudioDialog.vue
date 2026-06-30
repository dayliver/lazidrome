<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImportStore } from '@/stores/import'
import { useLibraryStore } from '@/stores/library'
import { isYoutubeUrl } from '@/lib/youtubeUrl'
import { notify } from '@/lib/notify'
import { Upload, FileAudio, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const props = defineProps({
  open: { type: Boolean, default: false },
  trackId: { type: String, required: true },
  trackTitle: { type: String, default: '' },
})

const emit = defineEmits(['update:open', 'replaced'])

const { t } = useI18n()
const importStore = useImportStore()
const library = useLibraryStore()

const mode = ref('local')
const fileInput = ref(null)
const isDragging = ref(false)
const stagingId = ref(null)
const stagedName = ref('')
const replacing = ref(false)

const ytUrl = ref('')
const ytResolving = ref(false)
const ytSourceUrl = ref('')
const ytItems = ref([])
const ytSelectedVideoId = ref('')

const canReplaceLocal = computed(() => !!stagingId.value && !replacing.value)
const canReplaceYoutube = computed(
  () => !!ytSelectedVideoId.value && !replacing.value && !ytResolving.value,
)

const selectedYtItem = computed(() =>
  ytItems.value.find((i) => i.videoId === ytSelectedVideoId.value) ?? null,
)

function resetState() {
  mode.value = 'local'
  stagingId.value = null
  stagedName.value = ''
  isDragging.value = false
  ytUrl.value = ''
  ytResolving.value = false
  ytSourceUrl.value = ''
  ytItems.value = []
  ytSelectedVideoId.value = ''
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      if (stagingId.value) {
        void importStore.cancelStaging(stagingId.value).catch(() => {})
      }
      resetState()
    }
  },
)

async function stageFile(fileList) {
  const file = [...fileList].find((f) => f && f.size > 0)
  if (!file) return
  if (stagingId.value) {
    try {
      await importStore.cancelStaging(stagingId.value)
    } catch {
      /* ignore */
    }
  }
  try {
    const data = await importStore.stageLocalFile(file)
    stagingId.value = data.stagingId
    stagedName.value = data.originalName || file.name
  } catch (e) {
    notify.error(e?.message || t('pages.details.replaceAudio.stageFailed'))
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

function onFileChange(e) {
  void stageFile(e.target.files || [])
  e.target.value = ''
}

function onDrop(e) {
  isDragging.value = false
  void stageFile(e.dataTransfer?.files || [])
}

async function resolveYoutube() {
  const url = ytUrl.value.trim()
  if (!isYoutubeUrl(url)) {
    notify.error(t('download.invalidUrl'))
    return
  }
  ytResolving.value = true
  ytItems.value = []
  ytSelectedVideoId.value = ''
  try {
    const data = await importStore.resolveYoutube(url)
    ytSourceUrl.value = data.sourceUrl || url
    ytItems.value = (data.items || []).map((item, idx) => ({
      videoId: item.videoId,
      webpageUrl: item.webpageUrl,
      title: item.title || `Track ${idx + 1}`,
    }))
    if (ytItems.value.length === 1) {
      ytSelectedVideoId.value = ytItems.value[0].videoId
    }
  } catch (e) {
    notify.error(e?.message || t('download.resolveFailed'))
  } finally {
    ytResolving.value = false
  }
}

async function handleReplace() {
  if (replacing.value) return
  replacing.value = true
  try {
    if (mode.value === 'local') {
      if (!stagingId.value) return
      await library.replaceTrackAudio(props.trackId, {
        source: 'staging',
        stagingId: stagingId.value,
      })
      stagingId.value = null
    } else {
      const item = selectedYtItem.value
      if (!item) return
      await library.replaceTrackAudio(props.trackId, {
        source: 'youtube',
        url: ytSourceUrl.value || ytUrl.value.trim(),
        videoId: item.videoId,
        webpageUrl: item.webpageUrl,
      })
    }
    notify.success(t('pages.details.replaceAudio.success'))
    emit('update:open', false)
    emit('replaced')
  } catch (e) {
    notify.error(e?.message || t('pages.details.replaceAudio.failed'))
  } finally {
    replacing.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md z-[100]" :show-close-button="!replacing">
      <DialogHeader>
        <DialogTitle>{{ t('pages.details.replaceAudio.title') }}</DialogTitle>
        <DialogDescription>
          {{ t('pages.details.replaceAudio.description', { title: trackTitle || '—' }) }}
        </DialogDescription>
      </DialogHeader>

      <p class="text-xs text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
        {{ t('pages.details.replaceAudio.preserveHint') }}
      </p>

      <div class="flex gap-1 p-1 rounded-lg bg-muted/60">
        <button
          type="button"
          class="flex-1 text-sm py-1.5 rounded-md transition-colors"
          :class="mode === 'local' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'"
          :disabled="replacing"
          @click="mode = 'local'"
        >
          {{ t('pages.details.replaceAudio.tabLocal') }}
        </button>
        <button
          type="button"
          class="flex-1 text-sm py-1.5 rounded-md transition-colors"
          :class="mode === 'youtube' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'"
          :disabled="replacing"
          @click="mode = 'youtube'"
        >
          {{ t('pages.details.replaceAudio.tabYoutube') }}
        </button>
      </div>

      <div v-if="mode === 'local'" class="space-y-3">
        <input
          ref="fileInput"
          type="file"
          class="hidden"
          accept="audio/*,.mp3,.flac,.m4a,.aac,.ogg,.opus,.wav,.wma,.ape,.alac"
          @change="onFileChange"
        />
        <div
          class="rounded-xl border-2 border-dashed p-6 text-center transition-colors"
          :class="isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'"
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="onDrop"
        >
          <Upload class="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p class="text-sm font-medium mb-1">{{ t('pages.details.replaceAudio.dropTitle') }}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            class="mt-2"
            :disabled="importStore.staging || replacing"
            @click="openFilePicker"
          >
            {{ importStore.staging ? t('import.files.staging') : t('pages.details.replaceAudio.chooseFile') }}
          </Button>
        </div>
        <div
          v-if="stagedName"
          class="flex items-center gap-2 text-sm text-muted-foreground px-1"
        >
          <FileAudio class="w-4 h-4 shrink-0" />
          <span class="truncate">{{ stagedName }}</span>
        </div>
      </div>

      <div v-else class="space-y-3">
        <div class="space-y-2">
          <Label for="replace-yt-url">{{ t('pages.details.replaceAudio.youtubeUrl') }}</Label>
          <div class="flex gap-2">
            <Input
              id="replace-yt-url"
              v-model="ytUrl"
              type="url"
              :placeholder="t('download.urlPlaceholder')"
              :disabled="replacing || ytResolving"
              @keydown.enter.prevent="resolveYoutube"
            />
            <Button
              type="button"
              variant="secondary"
              :disabled="!ytUrl.trim() || replacing || ytResolving"
              @click="resolveYoutube"
            >
              {{ ytResolving ? t('download.resolving') : t('download.resolve') }}
            </Button>
          </div>
        </div>

        <div v-if="ytItems.length > 1" class="space-y-2">
          <Label>{{ t('pages.details.replaceAudio.pickVideo') }}</Label>
          <div class="max-h-40 overflow-y-auto rounded-md border divide-y">
            <button
              v-for="item in ytItems"
              :key="item.videoId"
              type="button"
              class="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
              :class="ytSelectedVideoId === item.videoId ? 'bg-primary/10 font-medium' : ''"
              :disabled="replacing"
              @click="ytSelectedVideoId = item.videoId"
            >
              {{ item.title }}
            </button>
          </div>
        </div>

        <p v-else-if="selectedYtItem" class="text-sm text-muted-foreground px-1">
          {{ selectedYtItem.title }}
        </p>

        <p class="text-xs text-muted-foreground">
          {{ t('pages.details.replaceAudio.youtubeFormatHint') }}
        </p>
      </div>

      <DialogFooter class="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          :disabled="replacing"
          @click="emit('update:open', false)"
        >
          {{ t('common.cancel') }}
        </Button>
        <Button
          type="button"
          :disabled="mode === 'local' ? !canReplaceLocal : !canReplaceYoutube"
          @click="handleReplace"
        >
          <Loader2 v-if="replacing" class="w-4 h-4 mr-2 animate-spin" />
          {{
            replacing
              ? t('pages.details.replaceAudio.replacing')
              : t('pages.details.replaceAudio.confirm')
          }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
