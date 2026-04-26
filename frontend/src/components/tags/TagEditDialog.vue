<script setup>
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { X, Save, Info, Image as ImageIcon } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

import CoverArtTab from '@/components/shared/tabs/CoverArtTab.vue'
import TagBasicInfoTab from '@/components/tags/tabs/TagBasicInfoTab.vue'

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

const tabs = [
  { id: 'basic', label: '기본 정보', icon: Info },
  { id: 'cover', label: '커버 아트', icon: ImageIcon }
]

const invalidLabel = (s) => {
  const t = String(s || '').trim()
  if (!t) return '태그 이름을 입력해 주세요.'
  if (t.includes('..') || /[/\\]/.test(t)) return '이름에 /, \\, .. 는 사용할 수 없습니다.'
  if (t.length > 200) return '이름은 200자 이하여야 합니다.'
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
    toast.message('변경 사항이 없습니다.')
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
      if (!res.ok) throw new Error(data.error || '태그 이름 변경에 실패했습니다.')
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
      if (!res2.ok) throw new Error(data2.error || '이미지 저장에 실패했습니다.')
    }

    toast.success('저장했습니다.')
    emit('success', {
      newName: renamed ? newName : props.tagName,
      renamed,
      imageUpdated: coverChanged
    })
    handleClose()
  } catch (e) {
    toast.error(e.message || '저장 중 오류가 발생했습니다.')
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
        <h2 class="text-2xl font-black">태그 편집</h2>
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
        <Button variant="ghost" class="font-bold" :disabled="isSubmitting" @click="handleClose">취소</Button>
        <Button class="font-black px-12 shadow-lg" :disabled="isSubmitting" @click="handleSave">
          <span
            v-if="isSubmitting"
            class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          <Save class="w-4 h-4 mr-2" />
          변경사항 저장
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
