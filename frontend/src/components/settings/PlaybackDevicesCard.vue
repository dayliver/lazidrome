<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { MonitorSmartphone, Pencil, Trash2, EraserIcon, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { notify } from '@/lib/notify'
import { useDevicesStore } from '@/stores/devices'
import { usePreferencesStore } from '@/stores/preferences'
import { deviceIconForName } from '@/lib/deviceDisplay.js'

const devicesStore = useDevicesStore()
const prefs = usePreferencesStore()
const { t, locale } = useI18n()

/** 기간 삭제 패널이 열린 기기 id */
const purgeOpenFor = ref('')
const purgeFrom = ref('')
const purgeTo = ref('')
const busyId = ref('')

onMounted(() => void devicesStore.load({ force: true }))

const devices = computed(() => devicesStore.devices)

function formatWhen(value) {
  if (!value) return t('devices.never')
  // SQLite는 UTC 문자열로 저장한다 — 'Z'를 붙여야 로컬 시각으로 바르게 해석된다
  const dt = new Date(String(value).replace(' ', 'T') + 'Z')
  if (Number.isNaN(dt.getTime())) return t('devices.never')
  return dt.toLocaleString(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
}

async function onRename(device) {
  const next = prompt(t('devices.renamePrompt'), device.name)
  if (next == null) return
  const name = next.trim()
  if (!name || name === device.name) return
  busyId.value = device.id
  try {
    await devicesStore.updateDevice(device.id, { name })
    notify.success(t('devices.renamed'))
  } catch (e) {
    console.error(e)
    notify.error(t('devices.saveFailed'))
  } finally {
    busyId.value = ''
  }
}

async function onToggleExclude(device) {
  busyId.value = device.id
  try {
    await devicesStore.updateDevice(device.id, {
      excludeFromStats: !device.exclude_from_stats,
    })
  } catch (e) {
    console.error(e)
    notify.error(t('devices.saveFailed'))
  } finally {
    busyId.value = ''
  }
}

async function onDelete(device) {
  if (!confirm(t('devices.deleteConfirm', { name: device.name }))) return
  busyId.value = device.id
  try {
    await devicesStore.removeDevice(device.id)
    notify.success(t('devices.deleted'))
  } catch (e) {
    console.error(e)
    notify.error(t('devices.saveFailed'))
  } finally {
    busyId.value = ''
  }
}

function togglePurgePanel(device) {
  purgeOpenFor.value = purgeOpenFor.value === device.id ? '' : device.id
  purgeFrom.value = ''
  purgeTo.value = ''
}

async function onPurge(device) {
  if (!confirm(t('devices.purgeConfirm', { name: device.name }))) return
  busyId.value = device.id
  try {
    const result = await devicesStore.purgePlays(device.id, {
      from: purgeFrom.value || null,
      to: purgeTo.value || null,
      timezone: prefs.effectiveTimezone,
    })
    if (result.deleted > 0) notify.success(t('devices.purged', { count: result.deleted }))
    else notify.info(t('devices.purgeNone'))
    purgeOpenFor.value = ''
  } catch (e) {
    console.error(e)
    notify.error(t('devices.saveFailed'))
  } finally {
    busyId.value = ''
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <MonitorSmartphone class="w-5 h-5 text-primary" />
        {{ t('devices.manageTitle') }}
      </CardTitle>
      <CardDescription>{{ t('devices.manageDescription') }}</CardDescription>
    </CardHeader>

    <CardContent class="space-y-4">
      <p v-if="devicesStore.loading && !devices.length" class="text-sm text-muted-foreground">
        <Loader2 class="inline w-4 h-4 animate-spin mr-1.5 align-[-3px]" aria-hidden="true" />
        {{ t('common.loading') }}
      </p>

      <p v-else-if="devicesStore.error" class="text-sm text-destructive">
        {{ t('devices.loadFailed') }}
      </p>

      <p v-else-if="!devices.length" class="text-sm text-muted-foreground">
        {{ t('devices.empty') }}
      </p>

      <ul v-else class="space-y-3" role="list">
        <li
          v-for="device in devices"
          :key="device.id"
          class="rounded-xl border bg-muted/20 p-3 space-y-3"
          :class="{ 'opacity-60': device.exclude_from_stats }"
        >
          <div class="flex items-start gap-3">
            <component
              :is="deviceIconForName(device.name)"
              class="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-bold text-sm truncate">{{ device.name }}</span>
                <span
                  v-if="device.id === devicesStore.thisDeviceId"
                  class="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground"
                >
                  {{ t('devices.thisDevice') }}
                </span>
                <span
                  v-if="device.exclude_from_stats"
                  class="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase text-destructive"
                >
                  {{ t('devices.excludedBadge') }}
                </span>
              </div>
              <p class="text-xs text-muted-foreground">
                {{ t('devices.colPlays') }}: {{ t('devices.plays', { count: device.play_count }) }}
                · {{ t('devices.colLastPlayed') }}: {{ formatWhen(device.last_played_at) }}
                · {{ t('devices.colLastSeen') }}: {{ formatWhen(device.last_seen_at) }}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              class="h-7 text-[11px]"
              :disabled="busyId === device.id"
              @click="onRename(device)"
            >
              <Pencil class="w-3 h-3 mr-1.5" aria-hidden="true" />
              {{ t('devices.rename') }}
            </Button>
            <Button
              :variant="device.exclude_from_stats ? 'default' : 'outline'"
              size="sm"
              class="h-7 text-[11px]"
              :disabled="busyId === device.id"
              :title="
                device.exclude_from_stats
                  ? t('devices.excludeOff', { name: device.name })
                  : t('devices.excludeOn', { name: device.name })
              "
              @click="onToggleExclude(device)"
            >
              {{ t('devices.excludeFromStats') }}
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-7 text-[11px]"
              :disabled="busyId === device.id"
              @click="togglePurgePanel(device)"
            >
              <EraserIcon class="w-3 h-3 mr-1.5" aria-hidden="true" />
              {{ t('devices.purge') }}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 text-[11px] text-destructive hover:text-destructive"
              :disabled="busyId === device.id"
              @click="onDelete(device)"
            >
              <Trash2 class="w-3 h-3 mr-1.5" aria-hidden="true" />
              {{ t('devices.deleteDevice') }}
            </Button>
          </div>

          <div v-if="purgeOpenFor === device.id" class="rounded-lg border border-dashed p-3 space-y-3">
            <p class="text-xs font-bold">{{ t('devices.purgeTitle', { name: device.name }) }}</p>
            <p class="text-xs text-muted-foreground">{{ t('devices.purgeHint') }}</p>
            <div class="flex flex-wrap items-end gap-3">
              <div class="space-y-1">
                <Label class="text-[11px]">{{ t('devices.purgeFrom') }}</Label>
                <Input v-model="purgeFrom" type="date" class="h-8 w-[150px] text-xs" />
              </div>
              <div class="space-y-1">
                <Label class="text-[11px]">{{ t('devices.purgeTo') }}</Label>
                <Input v-model="purgeTo" type="date" class="h-8 w-[150px] text-xs" />
              </div>
              <Button
                variant="destructive"
                size="sm"
                class="h-8 text-[11px]"
                :disabled="busyId === device.id"
                @click="onPurge(device)"
              >
                {{ t('devices.purge') }}
              </Button>
            </div>
          </div>
        </li>
      </ul>

      <p v-if="devicesStore.unattributedPlays > 0" class="text-xs text-muted-foreground border-t pt-3">
        <strong>{{ t('devices.unattributed') }}</strong> ·
        {{ t('devices.unattributedHint', { count: devicesStore.unattributedPlays }) }}
      </p>
    </CardContent>
  </Card>
</template>
