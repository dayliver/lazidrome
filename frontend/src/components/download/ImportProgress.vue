<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  status: { type: Object, default: null },
})

const { t } = useI18n()

const percent = computed(() => {
  if (!props.status?.total) return 0
  return Math.round((props.status.done / props.status.total) * 100)
})

const isRunning = computed(
  () => props.status?.status === 'running',
)
</script>

<template>
  <div v-if="status" class="space-y-4 rounded-xl border p-4 bg-card/60">
    <div class="flex items-center justify-between gap-2">
      <p class="text-sm font-semibold">{{ t('download.progressTitle') }}</p>
      <span class="text-xs text-muted-foreground tabular-nums">
        {{ status.done }} / {{ status.total }}
        <span v-if="status.failed"> · {{ t('download.failedCount', { n: status.failed }) }}</span>
      </span>
    </div>

    <div class="h-2 rounded-full bg-muted overflow-hidden">
      <div
        class="h-full bg-primary transition-all duration-300"
        :style="{ width: `${percent}%` }"
      />
    </div>

    <p v-if="isRunning && status.current" class="text-xs text-muted-foreground truncate">
      {{ t('download.downloading', { title: status.current }) }}
    </p>

    <p
      v-else-if="status.status === 'completed'"
      class="text-sm text-primary"
    >
      {{ t('download.completed') }}
    </p>
    <p
      v-else-if="status.status === 'failed'"
      class="text-sm text-destructive"
    >
      {{ t('download.allFailed') }}
    </p>

    <ul
      v-if="status.items?.some((i) => i.status === 'error')"
      class="max-h-40 overflow-auto text-xs space-y-1 text-destructive"
    >
      <li v-for="item in status.items.filter((i) => i.status === 'error')" :key="item.videoId">
        {{ item.title }}: {{ item.error }}
      </li>
    </ul>
  </div>
</template>
