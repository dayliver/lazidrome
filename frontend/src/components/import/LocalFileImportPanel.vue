<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImportStore } from '@/stores/import'
import { useLibraryStore } from '@/stores/library'
import ImportTrackTable from '@/components/download/ImportTrackTable.vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { notify } from '@/lib/notify'
import { Upload, FileAudio } from 'lucide-vue-next'

const { t } = useI18n()
const importStore = useImportStore()
const library = useLibraryStore()

const emit = defineEmits(['done'])

const rows = ref([])
const phase = ref('pick') // pick | form | done
const isDragging = ref(false)
const fileInput = ref(null)

const canCommit = computed(
  () =>
    rows.value.some((r) => r.selected) &&
    !importStore.committing &&
    phase.value === 'form',
)

function rowFromStaging(data, index) {
  return {
    stagingId: data.stagingId,
    originalName: data.originalName,
    title: data.title || data.originalName || `Track ${index + 1}`,
    artist: data.artist || '',
    album: data.album || '',
    trackNo: index + 1,
    selected: true,
  }
}

async function stageFiles(fileList) {
  const files = [...fileList].filter((f) => f && f.size > 0)
  if (!files.length) return

  phase.value = 'form'
  let index = rows.value.length
  for (const file of files) {
    try {
      const data = await importStore.stageLocalFile(file)
      rows.value.push(rowFromStaging(data, index))
      index += 1
    } catch (e) {
      notify.error(e?.message || t('import.files.stageFailed', { name: file.name }))
    }
  }
  if (!rows.value.length) {
    phase.value = 'pick'
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

function onFileChange(e) {
  void stageFiles(e.target.files || [])
  e.target.value = ''
}

function onDrop(e) {
  isDragging.value = false
  void stageFiles(e.dataTransfer?.files || [])
}

function onDragOver(e) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

async function handleCommit() {
  if (!canCommit.value) return
  const items = rows.value
    .filter((r) => r.selected)
    .map((r) => ({
      stagingId: r.stagingId,
      title: String(r.title ?? '').trim(),
      artist: String(r.artist ?? '').trim(),
      album: String(r.album ?? '').trim(),
    }))

  const invalid = items.find((i) => !i.title || !i.artist || !i.album)
  if (invalid) {
    notify.error(t('import.files.metaRequired'))
    return
  }

  try {
    const body = await importStore.commitLocalUploads(items)
    if (body.failed > 0) {
      notify.error(t('import.files.partialFailed', { n: body.failed }))
    } else {
      notify.success(t('import.files.completed'))
    }
    phase.value = 'done'
    await library.fetchLibrary()
    emit('done')
  } catch (e) {
    notify.error(e?.message || t('import.files.commitFailed'))
  }
}

function resetAll() {
  rows.value = []
  phase.value = 'pick'
}

defineExpose({ resetAll })
</script>

<template>
  <div class="space-y-6">
    <input
      ref="fileInput"
      type="file"
      class="hidden"
      accept="audio/*,.mp3,.flac,.m4a,.aac,.ogg,.opus,.wav,.wma,.ape,.alac"
      multiple
      @change="onFileChange"
    />

    <div
      v-if="phase === 'pick' || (phase === 'form' && !rows.length)"
      class="rounded-xl border-2 border-dashed p-10 text-center transition-colors"
      :class="isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <Upload class="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
      <p class="font-medium mb-1">{{ t('import.files.dropTitle') }}</p>
      <p class="text-sm text-muted-foreground mb-4">{{ t('import.files.dropHint') }}</p>
      <Button type="button" variant="secondary" :disabled="importStore.staging" @click="openFilePicker">
        {{ importStore.staging ? t('import.files.staging') : t('import.files.chooseFiles') }}
      </Button>
    </div>

    <div v-if="phase === 'form' && rows.length" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <Label class="text-sm text-muted-foreground flex items-center gap-2">
          <FileAudio class="w-4 h-4" />
          {{ t('import.files.stagedCount', { count: rows.length }) }}
        </Label>
        <Button type="button" variant="outline" size="sm" :disabled="importStore.staging" @click="openFilePicker">
          {{ t('import.files.addMore') }}
        </Button>
      </div>

      <ImportTrackTable
        v-model:rows="rows"
        row-key="stagingId"
        :show-track-no="false"
      />

      <div class="flex justify-end gap-2">
        <Button type="button" variant="outline" @click="resetAll">
          {{ t('import.files.clear') }}
        </Button>
        <Button type="button" :disabled="!canCommit" @click="handleCommit">
          {{
            importStore.committing
              ? t('import.files.committing')
              : t('import.files.commit', { count: rows.filter((r) => r.selected).length })
          }}
        </Button>
      </div>
    </div>

    <div v-if="phase === 'done'" class="flex gap-2">
      <Button type="button" variant="secondary" @click="resetAll">
        {{ t('import.files.importMore') }}
      </Button>
    </div>
  </div>
</template>
