<script setup>
import { ref, watch } from 'vue'
import { ChevronLeft, User, Disc } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'

const props = defineProps({
  title: String,
  subtitle: String,
  imageUrl: String,
  stats: Array,
  isRoundImage: { type: Boolean, default: false }
})

const router = useRouter()
const hasError = ref(false)

watch(() => props.imageUrl, () => {
  hasError.value = false
})
</script>

<template>
  <div class="relative w-full space-y-12 pb-20 pt-16 md:pt-24 px-4 md:px-8">
    
    <Button variant="ghost" size="icon" class="absolute top-2 left-2 md:top-6 md:left-6 rounded-full hover:bg-muted" @click="router.back()">
      <ChevronLeft class="w-8 h-8" />
    </Button>

    <div class="flex flex-col md:flex-row items-center md:items-end gap-8 px-4">
      
      <div :class="[
        'w-48 h-48 md:w-64 md:h-64 shrink-0 bg-muted shadow-2xl border-4 border-background overflow-hidden relative',
        isRoundImage ? 'rounded-full' : 'rounded-xl'
      ]">
        <img 
          v-if="imageUrl && !hasError" 
          :src="imageUrl" 
          @error="hasError = true"
          class="absolute inset-0 w-full h-full object-cover z-10" 
        />
        <div class="absolute inset-0 flex items-center justify-center bg-secondary z-0">
          <User v-if="isRoundImage" class="w-24 h-24 text-muted-foreground/40" />
          <Disc v-else class="w-24 h-24 text-muted-foreground/40" />
        </div>
      </div>

      <div class="flex flex-col items-center md:items-start text-center md:text-left gap-4 flex-1 min-w-0">
        <div class="space-y-2">
          <span class="text-xs font-black tracking-[0.3em] text-muted-foreground uppercase">{{ subtitle }}</span>
          <h1 class="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-tight break-keep">
            {{ title || 'Loading...' }}
          </h1>
        </div>
        
        <div v-if="stats && stats.length" class="flex flex-wrap items-center justify-center md:justify-start gap-6 md:gap-8 mt-4">
          <div v-for="(stat, idx) in stats" :key="idx" class="flex flex-col">
            <span class="text-2xl font-black tabular-nums">{{ stat.value }}</span>
            <span class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{{ stat.label }}</span>
          </div>
        </div>
      </div>
      
    </div>

    <div class="space-y-16 px-2 md:px-6">
      <slot></slot>
    </div>
  </div>
</template>