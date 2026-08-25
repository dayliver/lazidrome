<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import HabitBarChart from '@/components/charts/HabitBarChart.vue'
import DeviceScopeSelect from '@/components/shared/DeviceScopeSelect.vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useLibraryStore } from '@/stores/library'
import { usePreferencesStore } from '@/stores/preferences'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import {
  formatListenSeconds,
  orderDayOfWeekMonFirst,
  labelTimeHabitBuckets,
} from '@/lib/listenTime'

const { t } = useI18n()
const library = useLibraryStore()
const prefs = usePreferencesStore()
const { auth, showAuthEmpty } = useRequiresAuth()

const range = ref('30d')
const loading = ref(false)
const error = ref(null)
const payload = ref(null)

const load = async () => {
  if (!auth.isAuthenticated) {
    payload.value = null
    return
  }
  loading.value = true
  error.value = null
  try {
    payload.value = await library.fetchStatsHabits(
      range.value,
      prefs.effectiveTimezone,
      prefs.statsDeviceScope,
    )
  } catch (e) {
    console.error(e)
    error.value = e
    payload.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(range, load)
watch(
  () => [auth.token, prefs.effectiveTimezone, prefs.statsDeviceScope],
  () => {
    if (auth.token) void load()
    else {
      payload.value = null
      error.value = null
    }
  }
)

const dayChart = computed(() => orderDayOfWeekMonFirst(payload.value?.dayOfWeek))
const timeChart = computed(() => labelTimeHabitBuckets(payload.value?.timeOfDay))
const totalListenLabel = computed(() => formatListenSeconds(payload.value?.totalListenSec))
</script>

<template>
  <PageLayout spacing="8">
    <ViewHeader
      :title="t('stats.title')"
      :description="t('stats.description')"
      :show-action="false"
    />

    <AuthEmptyState
      v-if="showAuthEmpty"
      :description="t('stats.authEmpty')"
    />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <Label class="text-sm text-muted-foreground shrink-0">{{ t('stats.range') }}</Label>
        <Select v-model="range">
          <SelectTrigger class="w-[200px]">
            <SelectValue :placeholder="t('stats.range')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">{{ t('stats.ranges.7d') }}</SelectItem>
            <SelectItem value="30d">{{ t('stats.ranges.30d') }}</SelectItem>
            <SelectItem value="all">{{ t('stats.ranges.all') }}</SelectItem>
          </SelectContent>
        </Select>
        <DeviceScopeSelect />
      </div>

      <p v-if="payload?.timezone" class="text-xs text-muted-foreground max-w-3xl leading-relaxed">
        {{ t('stats.timezoneNote', { statsZone: payload.timezone }) }}
        {{ t('stats.listenNote') }}
      </p>

      <LoadingSpinner v-if="loading && !payload" size="lg" :label="t('stats.loading')" />

      <div
        v-else-if="error"
        class="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        {{ t('stats.error') }}
      </div>

      <template v-else-if="payload">
        <p class="text-sm font-medium">
          {{ t('stats.total', { time: totalListenLabel }) }}
        </p>

        <section class="space-y-3">
          <h2 class="text-sm font-semibold">{{ t('stats.byWeekday') }}</h2>
          <div
            v-if="!dayChart.some((d) => d.listenSec > 0)"
            class="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground"
          >
            {{ t('stats.noData') }}
          </div>
          <div v-else class="bg-card border rounded-xl p-4 md:p-6 shadow-sm">
            <HabitBarChart :data="dayChart" variant="day" />
          </div>
        </section>

        <section class="space-y-3">
          <h2 class="text-sm font-semibold">{{ t('stats.byTime') }}</h2>
          <p class="text-xs text-muted-foreground">{{ t('stats.timeHint') }}</p>
          <div
            v-if="!timeChart.some((d) => d.listenSec > 0)"
            class="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground"
          >
            {{ t('stats.noData') }}
          </div>
          <div v-else class="bg-card border rounded-xl p-4 md:p-6 shadow-sm">
            <HabitBarChart :data="timeChart" variant="time" />
          </div>
        </section>
      </template>

      <div class="flex flex-wrap gap-2">
        <Button as-child variant="outline">
          <RouterLink to="/charts">{{ t('stats.toCharts') }}</RouterLink>
        </Button>
        <Button as-child variant="ghost">
          <RouterLink to="/">{{ t('stats.toHome') }}</RouterLink>
        </Button>
      </div>
    </template>
  </PageLayout>
</template>
