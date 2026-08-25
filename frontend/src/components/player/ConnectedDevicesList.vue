<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Speaker, WifiOff, Loader2, AlertTriangle, Square } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { usePlaybackSyncStore } from '@/stores/playbackSync.js'
import { deviceIconForName, sortConnectedDevices } from '@/lib/deviceDisplay.js'
import { notify } from '@/lib/notify'

defineProps({
  compact: { type: Boolean, default: false },
})

const sync = usePlaybackSyncStore()
const { t } = useI18n()

const sortedDevices = computed(() =>
  sortConnectedDevices(sync.connectedDevices, sync.deviceId),
)

const otherDeviceCount = computed(() =>
  Math.max(0, sortedDevices.value.length - 1),
)

/** 마스터 state 신선도 — "지금 보이는 게 진짜냐"를 알려주는 유일한 단서 */
const freshnessLabel = computed(() => {
  if (!sync.masterDeviceId || sync.isMaster) return ''
  const secs = sync.secondsSinceStateUpdate
  if (secs == null) return ''
  if (secs < 3) return t('player.devices.lastUpdateJustNow')
  return t('player.devices.lastUpdate', { secs })
})

// 재생 중인 기기가 있을 때만 의미가 있다
const canStopAll = computed(() => sync.connected && !!sync.masterDeviceId)

function onStopAll() {
  if (!canStopAll.value) return
  if (!confirm(t('player.devices.stopAllConfirm'))) return
  sync.stopAllDevices()
  notify.success(t('player.devices.stopAllDone'))
}
</script>

<template>
  <section
    class="connected-devices rounded-2xl border border-border/80 bg-muted/35"
    :class="compact ? 'connected-devices--compact px-0 py-1 border-0 bg-transparent' : 'px-4 py-3.5'"
    :aria-label="t('player.devices.title')"
  >
    <div class="connected-devices__header">
      <h4 class="connected-devices__title">{{ t('player.devices.title') }}</h4>
      <span v-if="sync.connected" class="connected-devices__status connected-devices__status--online">
        {{ t('player.devices.count', { count: sortedDevices.length }) }}
      </span>
      <span v-else class="connected-devices__status connected-devices__status--offline">
        <WifiOff class="w-3 h-3 shrink-0" aria-hidden="true" />
        {{ t('player.devices.disconnected') }}
      </span>
    </div>

    <p v-if="!sync.connected" class="connected-devices__hint">
      <Loader2 class="inline w-3.5 h-3.5 animate-spin mr-1.5 align-[-2px]" aria-hidden="true" />
      {{ t('player.devices.reconnecting') }}
    </p>

    <ul v-else-if="sortedDevices.length" class="connected-devices__list" role="list">
      <li
        v-for="device in sortedDevices"
        :key="device.deviceId"
        class="connected-devices__item"
        :class="{ 'connected-devices__item--master': device.isMaster }"
      >
        <component
          :is="deviceIconForName(device.deviceName)"
          class="connected-devices__icon shrink-0"
          aria-hidden="true"
        />
        <div class="connected-devices__meta min-w-0 flex-1">
          <span class="connected-devices__name truncate">
            {{ device.deviceName }}
          </span>
          <span class="connected-devices__badges">
            <span
              v-if="device.deviceId === sync.deviceId"
              class="connected-devices__badge connected-devices__badge--self"
            >
              {{ t('player.devices.thisDevice') }}
            </span>
            <span
              v-if="device.isMaster"
              class="connected-devices__badge connected-devices__badge--master"
            >
              <Speaker class="w-3 h-3 shrink-0" aria-hidden="true" />
              {{ t('player.devices.master') }}
            </span>
            <span
              v-if="device.stale"
              class="connected-devices__badge connected-devices__badge--stale"
              :title="t('player.devices.staleHint')"
            >
              <AlertTriangle class="w-3 h-3 shrink-0" aria-hidden="true" />
              {{ t('player.devices.stale') }}
            </span>
            <span
              v-else-if="device.deviceId !== sync.deviceId"
              class="connected-devices__badge connected-devices__badge--remote"
            >
              {{ t('player.devices.remote') }}
            </span>
          </span>
        </div>
      </li>
    </ul>

    <p v-else-if="sync.connected" class="connected-devices__hint">
      {{ t('player.devices.onlyThisDevice') }}
    </p>

    <p
      v-if="sync.connected && otherDeviceCount === 0 && sortedDevices.length === 1"
      class="connected-devices__footnote"
    >
      {{ t('player.devices.waitForOthers') }}
    </p>

    <div v-if="canStopAll" class="connected-devices__actions">
      <span v-if="freshnessLabel" class="connected-devices__freshness">{{ freshnessLabel }}</span>
      <Button variant="outline" size="sm" class="h-7 text-[11px] font-bold" @click="onStopAll">
        <Square class="w-3 h-3 mr-1.5" aria-hidden="true" />
        {{ t('player.devices.stopAll') }}
      </Button>
    </div>
  </section>
</template>

<style scoped>
.connected-devices--compact {
  padding: 0.25rem 0;
}

.connected-devices__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.625rem;
}

.connected-devices--compact .connected-devices__header {
  margin-bottom: 0.5rem;
}

.connected-devices__title {
  font-size: 0.6875rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}

.connected-devices__status {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
}

.connected-devices__status--online {
  color: var(--primary);
}

.connected-devices__status--offline {
  color: var(--muted-foreground);
}

.connected-devices__list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.connected-devices__item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.625rem;
  border-radius: 0.75rem;
  background: color-mix(in oklab, var(--background) 60%, transparent);
}

.connected-devices--compact .connected-devices__item {
  padding: 0.375rem 0.5rem;
}

.connected-devices__item--master {
  border: 1px solid color-mix(in oklab, var(--primary) 35%, transparent);
  background: color-mix(in oklab, var(--primary) 8%, transparent);
}

.connected-devices__icon {
  width: 1rem;
  height: 1rem;
  color: var(--muted-foreground);
}

.connected-devices__item--master .connected-devices__icon {
  color: var(--primary);
}

.connected-devices__meta {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.connected-devices__name {
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.2;
}

.connected-devices__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.connected-devices__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
}

.connected-devices__badge--self {
  background: color-mix(in oklab, var(--muted) 80%, transparent);
  color: var(--muted-foreground);
}

.connected-devices__badge--master {
  background: color-mix(in oklab, var(--primary) 15%, transparent);
  color: var(--primary);
}

.connected-devices__badge--stale {
  background: color-mix(in oklab, var(--destructive) 15%, transparent);
  color: var(--destructive);
}

.connected-devices__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding-top: 0.625rem;
  border-top: 1px solid color-mix(in oklab, var(--border) 70%, transparent);
}

.connected-devices__freshness {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--muted-foreground);
}

.connected-devices__badge--remote {
  background: color-mix(in oklab, var(--muted) 60%, transparent);
  color: var(--muted-foreground);
}

.connected-devices__hint,
.connected-devices__footnote {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  line-height: 1.4;
}

.connected-devices__footnote {
  margin-top: 0.5rem;
}
</style>
