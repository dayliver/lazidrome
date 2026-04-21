<script setup>
import { ref, watch } from 'vue'
import { User, Disc, Music } from 'lucide-vue-next'

const props = defineProps({
  src: String,
  type: { type: String, default: 'album' }, // 'artist' | 'album' | 'track'
  class: String
})

const hasError = ref(false)
watch(() => props.src, () => { hasError.value = false })
</script>

<template>
  <div :class="['relative overflow-hidden bg-muted flex items-center justify-center', props.class]">
    <img 
      v-if="src && !hasError" 
      :src="src" 
      @error="hasError = true" 
      class="absolute inset-0 w-full h-full object-cover" 
    />
    
    <User v-if="type === 'artist'" class="w-1/2 h-1/2 text-muted-foreground/40" />
    <Disc v-else-if="type === 'album'" class="w-1/2 h-1/2 text-muted-foreground/40" />
    <Music v-else class="w-1/2 h-1/2 text-muted-foreground/40" />
  </div>
</template>