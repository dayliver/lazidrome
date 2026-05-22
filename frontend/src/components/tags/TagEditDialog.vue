<script setup>
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { X, Save, Info, Image as ImageIcon } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import CoverArtTab from '@/components/shared/tabs/CoverArtTab.vue'
import TagBasicInfoTab from '@/components/tags/tabs/TagBasicInfoTab.vue'
const { t } = useI18n()

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  tagName: { type: String, required: true }
})

const emit = defineEmits(['update:isOpen', 'success'])

const auth = useAuthStore()
const activeTab = ref('basic')
const isSubmitting = ref(false)

/** MetadataEditDialog / PlaylistDialog 의 CoverArtTab 과 동일한 필드 형태 */
const localData = ref({
  name: '',
  newCoverFile: null,
  newCoverUrl: null
})

watch(
  () => [props.isOpen, props.tagName],
  ([open]) => {
    if (open) {
      activeTab.value = 'basic'
      localData.value = {
        name: props.tagName,
        newCoverFile: null,
        newCoverUrl: null
      }
    }
  },
  { immediate: true }
)

const tabs = computed(() => [
  { id: 'basic', label: t('metadata.tabBasic'), icon: Info },
  { id: 'cover', label: t('metadata.tabCover'), icon: ImageIcon }
])

const invalidLabel = (s) => {
  const value = String(s || '').trim()
  if (!value) return t('tagEdit.noName')
  if (value.includes('..') || /[/\\]/.test(value)) return t('tagEdit.invalidChars')
  if (value.length > 200) return t('tagEdit.maxLength')
  return ''
}

const handleClose = () => {
  emit('update:isOpen', false)
}

const handleSave = async () => {
  const newName = String(localData.value.name || '').trim()
  const nameErr = invalidLabel(newName)
  if (nameErr) {
    toast.error(nameErr)
    return
  }

  const renamed = newName !== props.tagName
  const coverChanged = !!(localData.value.newCoverFile || localData.value.newCoverUrl)

  if (!renamed && !coverChanged) {
    toast.message(t('tagEdit.noChanges'))
    handleClose()
    return
  }

  isSubmitting.value = true
  try {
    if (renamed) {
      const res = await auth.fetchWithAuth('/api/tags/rename', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName: props.tagName, newName })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || t('tagEdit.renameFailed'))
    }

    if (coverChanged) {
      const targetTag = renamed ? newName : props.tagName
      const form = new FormData()
      form.append('tagName', targetTag)
      if (localData.value.newCoverFile) {
        form.append('image', localData.value.newCoverFile)
      } else if (localData.value.newCoverUrl) {
        form.append('imageUrl', localData.value.newCoverUrl)
      }
      const res2 = await auth.fetchWithAuth('/api/tags/image', { method: 'POST', body: form })
      const data2 = await res2.json().catch(() => ({}))
      if (!res2.ok) throw new Error(data2.error || t('tagEdit.imageSaveFailed'))
    }

    toast.success(t('tagEdit.saved'))
    emit('success', {
      newName: renamed ? newName : props.tagName,
      renamed,
      imageUpdated: coverChanged
    })
    handleClose()
  } catch (e) {
    toast.error(e.message || t('tagEdit.saveError'))
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
  >
    <div class="bg-card w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl border-2 flex flex-col overflow-hidden">
      <header class="flex items-center justify-between px-8 py-5 border-b bg-muted/20">
        <h2 class="text-2xl font-black">{{ t('tagEdit.title') }}</h2>
        <Button variant="ghost" size="icon" :disabled="isSubmitting" @click="handleClose">
          <X />
        </Button>
      </header>

      <nav class="flex items-center border-b px-8 gap-8 bg-muted/5 shrink-0 overflow-x-auto no-scrollbar">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="flex items-center gap-2 py-4 text-sm font-black border-b-2 transition-all whitespace-nowrap focus:outline-none"
          :class="
            activeTab === tab.id
              ? 'border-primary text-primary translate-y-[1px]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
          @click="activeTab = tab.id"
        >
          <component :is="tab.icon" class="w-4 h-4" />
          {{ tab.label }}
        </button>
      </nav>

      <main class="flex-1 overflow-y-auto p-8 relative custom-scrollbar">
        <div v-show="activeTab === 'basic'">
          <TagBasicInfoTab v-model="localData" />
        </div>
        <div v-show="activeTab === 'cover'">
          <CoverArtTab v-model="localData" />
        </div>
      </main>

      <footer class="p-6 border-t bg-muted/20 flex justify-end gap-3">
        <Button variant="ghost" class="font-bold" :disabled="isSubmitting" @click="handleClose">{{ t('common.cancel') }}</Button>
        <Button class="font-black px-12 shadow-lg" :disabled="isSubmitting" @click="handleSave">
          <span
            v-if="isSubmitting"
            class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          <Save class="w-4 h-4 mr-2" />
          {{ t('common.save') }}
        </Button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: hsl(var(--muted));
  border-radius: 10px;
}
</style>
