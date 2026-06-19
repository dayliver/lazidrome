<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Upload, Link, Clipboard, X, Check, Image as ImageIcon } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'vue-sonner'
import { compressCoverImage } from '@/lib/compressCoverImage'
const { t } = useI18n()

const props = defineProps({
  modelValue: { type: Object, required: true }
})
const emit = defineEmits(['update:modelValue'])

const previewUrl = ref(null)
const urlInput = ref('')
const fileInput = ref(null)

// 💡 1. 파일 처리 핵심 로직 (미리보기 및 데이터 바인딩)
const processFile = async (file) => {
  if (!file || !file.type.startsWith('image/')) {
    toast.error(t('coverArt.imagesOnly'))
    return
  }

  let uploadFile = file
  try {
    uploadFile = await compressCoverImage(file)
  } catch (err) {
    console.warn('Cover compress failed, using original:', err)
  }

  // 기존 미리보기 메모리 해제
  if (previewUrl.value && previewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl.value)
  }

  previewUrl.value = URL.createObjectURL(uploadFile)

  // 부모(MetadataEditDialog 등)의 formData 업데이트
  emit('update:modelValue', {
    ...props.modelValue,
    newCoverFile: uploadFile,
    newCoverUrl: null, // 파일이 우선순위
  })
}

const handleFileChange = (e) => {
  const file = e.target.files[0]
  if (file) void processFile(file)
}

// 💡 2. URL 입력 처리
const handleUrlSubmit = () => {
  if (!urlInput.value) return
  previewUrl.value = urlInput.value
  emit('update:modelValue', { 
    ...props.modelValue, 
    newCoverUrl: urlInput.value, 
    newCoverFile: null 
  })
}

// 💡 3. [킬러 기능] 클립보드 붙여넣기 처리
const handlePaste = (e) => {
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      e.preventDefault()
      e.stopPropagation()
      const file = item.getAsFile()
      if (file) void processFile(file)
      break
    }
  }
}

onMounted(() => {
  window.addEventListener('paste', handlePaste)
})

onUnmounted(() => {
  window.removeEventListener('paste', handlePaste)
  if (previewUrl.value && previewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl.value)
  }
})

const clearSelection = () => {
  previewUrl.value = null
  urlInput.value = ''
  emit('update:modelValue', { ...props.modelValue, newCoverFile: null, newCoverUrl: null })
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-500 h-full flex flex-col">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-10 flex-1">
      
      <div class="space-y-6">
        <div>
          <h3 class="text-lg font-black mb-1">{{ t('coverArt.newImageTitle') }}</h3>
          <p class="text-xs text-muted-foreground">{{ t('coverArt.newImageHint') }}</p>
        </div>

        <div 
          @click="fileInput.click()"
          class="group border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 bg-muted/5 hover:bg-muted/20 hover:border-primary/50 transition-all cursor-pointer relative overflow-hidden"
        >
          <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleFileChange" />
          <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
            <Upload class="w-8 h-8 text-primary" />
          </div>
          <div class="text-center">
            <p class="font-bold">{{ t('coverArt.uploadTitle') }}</p>
            <p class="text-[10px] text-muted-foreground mt-1">{{ t('coverArt.uploadHint') }}</p>
          </div>
        </div>

        <div class="space-y-3 pt-2">
          <Label class="text-[11px] font-black text-muted-foreground uppercase flex items-center gap-2">
            <Link class="w-3 h-3 text-primary" /> {{ t('coverArt.urlLabel') }}
          </Label>
          <div class="flex gap-2">
            <Input v-model="urlInput" placeholder="https://..." class="flex-1" @keyup.enter="handleUrlSubmit" />
            <Button variant="secondary" @click="handleUrlSubmit" class="font-bold">{{ t('coverArt.fetch') }}</Button>
          </div>
        </div>

        <div class="bg-primary/5 border border-primary/20 p-4 rounded-xl flex items-center gap-4 border-l-4 border-l-primary">
          <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Clipboard class="w-5 h-5 text-primary" />
          </div>
          <div>
            <p class="text-xs font-bold text-primary tracking-tight">{{ t('coverArt.clipboardTitle') }}</p>
            <p class="text-[10px] text-muted-foreground">{{ t('coverArt.clipboardHint') }}</p>
          </div>
        </div>
      </div>

      <div class="flex flex-col items-center justify-center bg-muted/20 rounded-2xl border-2 p-8 relative overflow-hidden shadow-inner">
        <Label class="absolute top-4 left-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">{{ t('coverArt.previewLabel') }}</Label>
        
        <div v-if="previewUrl" class="relative group animate-in zoom-in duration-300">
          <div class="w-64 h-64 rounded-xl shadow-2xl overflow-hidden border-4 border-background relative">
            <img :src="previewUrl" class="w-full h-full object-cover" />
            <div class="absolute inset-0 bg-primary/10 group-hover:bg-transparent transition-colors"></div>
          </div>
          <Button 
            variant="destructive" 
            size="icon" 
            class="absolute -top-3 -right-3 rounded-full shadow-lg h-8 w-8" 
            @click="clearSelection"
          >
            <X class="w-4 h-4" />
          </Button>
          <p class="text-center mt-6 text-xs font-black text-primary flex items-center justify-center gap-1">
             <Check class="w-4 h-4" /> {{ t('coverArt.imageReady') }}
          </p>
        </div>

        <div v-else class="flex flex-col items-center text-muted-foreground/30">
          <ImageIcon class="w-24 h-24 mb-4 stroke-[1px]" />
          <p class="font-black text-sm tracking-widest uppercase">{{ t('coverArt.noImageSelected') }}</p>
        </div>
      </div>

    </div>
  </div>
</template>