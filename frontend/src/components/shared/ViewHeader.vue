<script setup>
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-vue-next'

defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  showAction: {
    type: Boolean,
    default: true
  }
})

defineEmits(['action'])
</script>

<template>
  <div class="flex items-end justify-between border-b pb-4 gap-4">
    <div>
      <h1 class="text-3xl font-black tracking-tight">
        <slot name="title-prefix" />
        {{ title }}
      </h1>
      <p v-if="description" class="text-sm font-medium text-muted-foreground mt-1">
        {{ description }}
      </p>
    </div>

    <Button
      v-if="showAction"
      variant="outline"
      size="icon"
      class="rounded-full"
      @click="$emit('action')"
    >
      <slot name="action">
        <Plus class="w-5 h-5" />
      </slot>
    </Button>
  </div>
</template>
