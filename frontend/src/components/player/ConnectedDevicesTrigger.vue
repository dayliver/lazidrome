<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Cast } from 'lucide-vue-next'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import ConnectedDevicesList from '@/components/player/ConnectedDevicesList.vue'
import { usePlaybackSyncStore } from '@/stores/playbackSync.js'
import { useAuthStore } from '@/stores/auth'
import { sortConnectedDevices } from '@/lib/deviceDisplay.js'

const props = defineProps({
  variant: {
    type: String,
    default: 'icon',
    validator: (v) => ['icon', 'chip'].includes(v),
  },
  popoverSide: {
    type: String,
    default: 'bottom',
  },
  popoverAlign: {
    type: String,
    default: 'end',
  },
})
const auth = useAuthStore()
const sync = usePlaybackSyncStore()
const { t } = useI18n()

const connectedDeviceCount = computed(() => sync.connectedDevices.length)

const sortedDevices = computed(() =>
  sortConnectedDevices(sync.connectedDevices, sync.deviceId),
)

const summaryLabel = computed(() => {
  if (!sync.connected) return t('player.devices.disconnected')
  const n = Math.max(connectedDeviceCount.value, 1)
  const master = sortedDevices.value.find((d) => d.isMaster)
  const countText = t('player.devices.count', { count: n })
  if (master && n > 1) {
    return `${countText} · ${master.deviceName}`
  }
  return countText
})

const devicesButtonLabel = computed(() => {
  if (connectedDeviceCount.value > 0) {
    return t('player.devices.openListWithCount', { count: connectedDeviceCount.value })
  }
  return t('player.devices.openList')
})
</script>

<template>
  <Popover v-if="auth.isAuthenticated">
    <PopoverTrigger as-child>
      <button
        v-if="variant === 'chip'"
        type="button"
        class="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
        :aria-label="devicesButtonLabel"
      >
        <Cast class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span class="truncate">{{ summaryLabel }}</span>
      </button>
      <button
        v-else
        type="button"
        class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
        :aria-label="devicesButtonLabel"
      >
        <Cast class="h-4 w-4" aria-hidden="true" />
        <span
          v-if="connectedDeviceCount > 0"
          class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
        >
          {{ connectedDeviceCount }}
        </span>
      </button>
    </PopoverTrigger>
    <PopoverContent
      class="w-72 p-3"
      :align="props.popoverAlign"
      :side="props.popoverSide"
      :side-offset="8"
      @click.stop
    >
      <ConnectedDevicesList compact />
    </PopoverContent>
  </Popover>
</template>
