<script setup>
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDevicesStore } from '@/stores/devices'
import { usePreferencesStore } from '@/stores/preferences'

/**
 * 통계 기기 스코프 선택. `''`(ALL)이면 서버가 '통계 제외' 기기만 빼고 전부 집계한다.
 * 특정 기기를 고르면 제외 플래그와 무관하게 그 기기만 본다.
 * 값은 preferences에 두어 통계·차트가 같은 스코프를 공유한다.
 */
const ALL = ''
const devicesStore = useDevicesStore()
const prefs = usePreferencesStore()
const { t } = useI18n()

onMounted(() => void devicesStore.load())

const options = computed(() =>
  devicesStore.devices.map((d) => ({
    id: String(d.id),
    label:
      String(d.id) === devicesStore.thisDeviceId
        ? `${d.name} (${t('devices.thisDevice')})`
        : d.name,
    excluded: !!d.exclude_from_stats,
  })),
)

// 선택한 기기가 목록에서 사라지면(삭제 등) 전체로 되돌린다
const selected = computed({
  get: () => {
    const cur = prefs.statsDeviceScope
    return options.value.some((o) => o.id === cur) ? cur : ALL
  },
  set: (v) => prefs.setStatsDeviceScope(v ?? ALL),
})

const excludedNote = computed(() => {
  if (selected.value !== ALL) return ''
  const n = devicesStore.excludedCount
  return n > 0 ? t('devices.excludedNote', { count: n }) : ''
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <Label class="text-sm text-muted-foreground shrink-0">{{ t('devices.scopeLabel') }}</Label>
    <Select v-model="selected">
      <SelectTrigger class="w-[220px]">
        <SelectValue :placeholder="t('devices.scopeAll')" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem :value="ALL">{{ t('devices.scopeAll') }}</SelectItem>
        <SelectItem v-for="opt in options" :key="opt.id" :value="opt.id">
          {{ opt.label }}{{ opt.excluded ? ` · ${t('devices.excludedBadge')}` : '' }}
        </SelectItem>
      </SelectContent>
    </Select>
    <span v-if="excludedNote" class="text-xs text-muted-foreground">{{ excludedNote }}</span>
  </div>
</template>
