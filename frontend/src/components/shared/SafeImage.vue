<script setup>
import { ref, watch, computed } from 'vue'
import { User, Disc, Music } from 'lucide-vue-next'

const props = defineProps({
  src: String,
  type: { type: String, default: 'album' }, // 'artist' | 'album' | 'track'
  alt: { type: String, default: '' },
  class: String,
})

const defaultAlt = computed(() => {
  if (props.alt) return props.alt
  if (props.type === 'artist') return '아티스트 이미지'
  if (props.type === 'album') return '앨범 커버'
  return '곡 앨범 아트'
})

const hasError = ref(false)
watch(() => props.src, () => { hasError.value = false })
</script>

<template>
  <div :class="['relative overflow-hidden bg-muted flex items-center justify-center', props.class]">
    <img
      v-if="src && !hasError"
      :src="src"
      :alt="defaultAlt"
      @error="hasError = true"
      class="absolute inset-0 w-full h-full object-cover"
    />
    
    <User v-if="type === 'artist'" class="w-1/2 h-1/2 text-muted-foreground/40" />
    <Disc v-else-if="type === 'album'" class="w-1/2 h-1/2 text-muted-foreground/40" />
    <Music v-else class="w-1/2 h-1/2 text-muted-foreground/40" />
  </div>
</template>
