<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Disc } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
})

const emit = defineEmits(['update:isOpen', 'success'])

const { t } = useI18n()
const router = useRouter()
const library = useLibraryStore()

const name = ref('')
const year = ref('')
const isSubmitting = ref(false)

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      name.value = ''
      year.value = ''
    }
  },
)

function close() {
  emit('update:isOpen', false)
}

async function submit() {
  const albumName = name.value.trim()
  if (!albumName) {
    toast.error(t('pages.albums.createNoName'))
    return
  }
  const yearNum = year.value.trim() === '' ? null : Number(year.value)
  if (yearNum != null && (!Number.isFinite(yearNum) || yearNum < 0)) {
    toast.error(t('pages.albums.createBadYear'))
    return
  }

  isSubmitting.value = true
  try {
    const id = await library.createAlbum(albumName, yearNum)
    emit('success', id)
    close()
    toast.success(t('pages.albums.createDone'))
    void router.push({ name: 'album-detail', params: { id } })
  } catch (e) {
    toast.error(e?.message || t('pages.albums.createFailed'))
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      @click.self="close"
    >
      <div class="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl" role="dialog" aria-modal="true">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 class="flex items-center gap-2 text-lg font-bold">
              <Disc class="h-5 w-5 text-primary" />
              {{ t('pages.albums.createTitle') }}
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">{{ t('pages.albums.createHint') }}</p>
          </div>
          <Button variant="ghost" size="icon" class="shrink-0" @click="close">
            <X class="h-5 w-5" />
          </Button>
        </div>

        <div class="space-y-4">
          <div class="space-y-2">
            <Label for="album-create-name">{{ t('metadata.albumName') }}</Label>
            <Input
              id="album-create-name"
              v-model="name"
              class="border-2"
              :placeholder="t('pages.albums.createNamePlaceholder')"
              @keyup.enter="submit"
            />
          </div>
          <div class="space-y-2">
            <Label for="album-create-year">{{ t('metadata.releaseYear') }}</Label>
            <Input
              id="album-create-year"
              v-model="year"
              type="number"
              class="border-2"
              :placeholder="t('pages.albums.createYearPlaceholder')"
            />
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <Button variant="outline" :disabled="isSubmitting" @click="close">
            {{ t('common.cancel') }}
          </Button>
          <Button :disabled="isSubmitting" @click="submit">
            {{ isSubmitting ? t('common.loading') : t('pages.albums.createSubmit') }}
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
