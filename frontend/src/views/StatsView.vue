<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { VisXYContainer, VisStackedBar, VisAxis } from '@unovis/vue'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'

const library = useLibraryStore()
const auth = useAuthStore()

const range = ref('7d')
const loading = ref(false)
const error = ref(null)
const payload = ref(null)

const rangeLabels = {
  '24h': '최근 24시간',
  '48h': '최근 48시간',
  '7d': '최근 7일',
  '30d': '최근 30일',
  all: '통산(월 단위)',
}

const load = async () => {
  if (!auth.isAuthenticated) {
    payload.value = null
    return
  }
  loading.value = true
  error.value = null
  try {
    payload.value = await library.fetchStatsPlays(range.value)
  } catch (e) {
    console.error(e)
    error.value = e
    payload.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)

watch(range, () => {
  void load()
})

watch(
  () => auth.token,
  (t) => {
    if (t) void load()
    else {
      payload.value = null
      error.value = null
    }
  }
)

const seriesChart = computed(() => {
  const s = payload.value?.series
  if (!Array.isArray(s)) return []
  return s.map((row) => ({
    label: String(row.label ?? ''),
    count: Number(row.count) || 0,
  }))
})

const seriesTotal = computed(() => seriesChart.value.reduce((a, b) => a + b.count, 0))

const timeOfDayChart = computed(() => {
  const t = payload.value?.timeOfDay
  if (!t) return []
  return [
    { label: '새벽(<8시)', count: t.dawn },
    { label: '오전(8–12)', count: t.morning },
    { label: '오후(12–17)', count: t.afternoon },
    { label: '저녁(17시+)', count: t.evening },
  ]
})

const timeOfDayTotal = computed(() => timeOfDayChart.value.reduce((a, b) => a + b.count, 0))
</script>

<template>
  <div class="w-full space-y-8">
    <ViewHeader
      title="Stats"
      description="기간별 재생 이벤트(절반 이상 재생으로 기록된 횟수)와 시간대 분포를 확인합니다."
      :show-action="false"
    />

    <div
      v-if="!auth.isAuthenticated"
      class="rounded-2xl border border-border bg-card/50 p-8 text-center space-y-4"
    >
      <p class="text-muted-foreground">통계를 보려면 설정에서 서버에 로그인하세요.</p>
      <Button as-child variant="outline">
        <RouterLink to="/settings">설정</RouterLink>
      </Button>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <Label class="text-sm text-muted-foreground shrink-0">기간</Label>
        <Select v-model="range">
          <SelectTrigger class="w-[200px]">
            <SelectValue placeholder="기간" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">{{ rangeLabels['24h'] }}</SelectItem>
            <SelectItem value="48h">{{ rangeLabels['48h'] }}</SelectItem>
            <SelectItem value="7d">{{ rangeLabels['7d'] }}</SelectItem>
            <SelectItem value="30d">{{ rangeLabels['30d'] }}</SelectItem>
            <SelectItem value="all">{{ rangeLabels.all }}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p v-if="payload?.timezonePolicy" class="text-xs text-muted-foreground max-w-3xl leading-relaxed">
        {{ payload.timezonePolicy }}
      </p>

      <div v-if="loading && !payload" class="py-20 flex flex-col items-center gap-3">
        <div class="w-9 h-9 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p class="text-sm text-muted-foreground">통계를 불러오는 중…</p>
      </div>

      <div
        v-else-if="error"
        class="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        통계를 불러오지 못했습니다. 네트워크와 로그인을 확인해 주세요.
      </div>

      <template v-else-if="payload">
        <section class="space-y-3">
          <h2 class="text-sm font-semibold text-foreground">
            재생 추이
            <span class="font-normal text-muted-foreground">
              ({{ rangeLabels[payload.range] || payload.range }} · 총 {{ seriesTotal }}회)
            </span>
          </h2>
          <div
            v-if="seriesTotal === 0"
            class="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground"
          >
            이 기간에 기록된 재생 이벤트가 없습니다.
          </div>
          <div v-else class="bg-card border rounded-xl p-6 shadow-sm">
            <ChartContainer
              :config="{ count: { label: '재생', color: 'var(--chart-1)' } }"
              class="h-[280px] w-full min-w-0"
            >
              <!-- Unovis XY charts use numeric x; ordinal labels via tick-format (see unovis.dev tips / ordinal) -->
              <VisXYContainer :data="seriesChart">
                <VisStackedBar :x="(_, i) => i" :y="(d) => d.count" color="var(--chart-1)" />
                <VisAxis
                  type="x"
                  :tick-format="(tick) => seriesChart[Number(tick)]?.label ?? ''"
                  :num-ticks="Math.max(1, seriesChart.length)"
                />
                <ChartTooltip />
              </VisXYContainer>
            </ChartContainer>
          </div>
        </section>

        <section class="space-y-3">
          <h2 class="text-sm font-semibold text-foreground">
            시간대별 재생
            <span class="font-normal text-muted-foreground"> (총 {{ timeOfDayTotal }}회) </span>
          </h2>
          <div
            v-if="timeOfDayTotal === 0"
            class="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground"
          >
            이 기간에 시간대별 데이터가 없습니다.
          </div>
          <div v-else class="bg-card border rounded-xl p-6 max-w-lg shadow-sm">
            <ChartContainer
              :config="{ count: { label: '재생', color: 'var(--chart-2)' } }"
              class="h-[220px]"
            >
              <VisXYContainer :data="timeOfDayChart">
                <VisStackedBar :x="(_, i) => i" :y="(d) => d.count" color="var(--chart-2)" />
                <VisAxis
                  type="x"
                  :grid-line="false"
                  :tick-format="(tick) => timeOfDayChart[Number(tick)]?.label ?? ''"
                  :num-ticks="timeOfDayChart.length"
                />
                <ChartTooltip />
              </VisXYContainer>
            </ChartContainer>
          </div>
        </section>
      </template>

      <div>
        <Button as-child variant="outline">
          <RouterLink to="/">홈으로</RouterLink>
        </Button>
      </div>
    </template>
  </div>
</template>
