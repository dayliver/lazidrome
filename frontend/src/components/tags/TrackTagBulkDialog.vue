<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '@/stores/library'
import { useTrackTags } from '@/composables/useTrackTags'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X, Tags, Check, Minus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const props = defineProps({
  isOpen: { type: Boolean, required: true },
  tracks: { type: Array, required: true, default: () => [] }
})

const emit = defineEmits(['update:isOpen', 'success'])

const { t } = useI18n()
const library = useLibraryStore()
const { allTags, loading, fetchTags } = useTrackTags()

const searchQuery = ref('')
const newTag = ref('')
const isSubmitting = ref(false)

/** 열릴 때 굳혀 두는 선택 곡들의 태그 — 클릭 도중 기준선이 흔들리지 않게 한다 */
const baseTags = ref([])
/** 태그별 지시: 'add'(전부 넣기) | 'remove'(전부 빼기), 없으면 그대로 둔다 */
const pending = ref(new Map())
/** 카탈로그에 아직 없는, 방금 입력한 태그 */
const extraTags = ref([])

const trackCount = computed(() => baseTags.value.length)

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return
    searchQuery.value = ''
    newTag.value = ''
    pending.value = new Map()
    extraTags.value = []
    baseTags.value = props.tracks.map((track) => new Set(track.tags || []))
    void fetchTags()
  },
  { immediate: true }
)

/** 태그마다 선택 곡 중 몇 곡이 갖고 있는지 — 3단 상태(전부/일부/없음)의 근거다 */
const ownedCounts = computed(() => {
  const counts = new Map()
  for (const tags of baseTags.value) {
    for (const name of tags) counts.set(name, (counts.get(name) || 0) + 1)
  }
  return counts
})

const catalog = computed(() => {
  const byName = new Map()
  for (const tag of allTags.value) byName.set(tag.name, { name: tag.name, count: tag.count || 0 })
  for (const name of ownedCounts.value.keys()) {
    if (!byName.has(name)) byName.set(name, { name, count: 0 })
  }
  for (const name of extraTags.value) {
    if (!byName.has(name)) byName.set(name, { name, count: 0 })
  }

  // 선택 곡에 이미 붙어 있는 것부터, 그다음은 라이브러리에서 흔한 것부터
  return [...byName.values()].sort((a, b) => {
    const aOwned = ownedCounts.value.get(a.name) || 0
    const bOwned = ownedCounts.value.get(b.name) || 0
    if (aOwned !== bOwned) return bOwned - aOwned
    if (b.count !== a.count) return b.count - a.count
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
})

const filtered = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return catalog.value
  return catalog.value.filter((tag) => tag.name.toLowerCase().includes(query))
})

const baseStateOf = (name) => {
  const owned = ownedCounts.value.get(name) || 0
  if (owned === 0) return 'none'
  return owned === trackCount.value ? 'all' : 'some'
}

const stateOf = (name) => {
  const want = pending.value.get(name)
  if (want === 'add') return true
  if (want === 'remove') return false
  const base = baseStateOf(name)
  if (base === 'all') return true
  return base === 'some' ? 'indeterminate' : false
}

/**
 * 클릭 한 번에 한 칸씩 돈다.
 * 일부 곡에만 있던 태그는 「그대로 → 전부 넣기 → 전부 빼기 → 그대로」로 돌아 되돌릴 길을 남긴다.
 */
const cycle = (name) => {
  const next = new Map(pending.value)
  const want = next.get(name)
  const base = baseStateOf(name)

  if (base === 'none') {
    if (want === 'add') next.delete(name)
    else next.set(name, 'add')
  }
  else if (base === 'all') {
    if (want === 'remove') next.delete(name)
    else next.set(name, 'remove')
  }
  else if (want === undefined) next.set(name, 'add')
  else if (want === 'add') next.set(name, 'remove')
  else next.delete(name)

  pending.value = next
}

/** 실제로 서버에 보낼 변경만 추린다 — 이미 그 상태인 태그는 뺀다 */
const changes = computed(() => {
  const add = []
  const remove = []
  for (const [ name, want ] of pending.value) {
    const owned = ownedCounts.value.get(name) || 0
    if (want === 'add' && owned < trackCount.value) add.push(name)
    if (want === 'remove' && owned > 0) remove.push(name)
  }
  return { add, remove }
})

const hasChanges = computed(() => changes.value.add.length + changes.value.remove.length > 0)

const submitNewTag = () => {
  const name = newTag.value.trim()
  if (!name) return
  const known = allTags.value.some((tag) => tag.name === name) || ownedCounts.value.has(name)
  if (!known && !extraTags.value.includes(name)) extraTags.value = [ ...extraTags.value, name ]
  pending.value = new Map(pending.value).set(name, 'add')
  newTag.value = ''
  searchQuery.value = ''
}

const handleClose = () => {
  emit('update:isOpen', false)
}

const handleApply = async () => {
  if (!hasChanges.value) return
  const trackIds = props.tracks.map((track) => track.id)
  if (trackIds.length === 0) {
    toast.warning(t('tagBulk.noTracks'))
    return
  }

  isSubmitting.value = true
  try {
    const updated = await library.bulkUpdateTrackTags(trackIds, changes.value)
    await fetchTags({ force: true })
    toast.success(t('tagBulk.applied', { count: updated }))
    emit('success')
    handleClose()
  }
  catch (error) {
    console.error('태그 일괄 적용 실패:', error)
    toast.error(t('tagBulk.failed'))
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
    <div class="bg-card w-full max-w-sm md:max-w-md rounded-2xl shadow-2xl border flex flex-col overflow-hidden max-h-[80vh]">

      <header class="flex items-center justify-between px-6 py-4 border-b bg-muted/20 shrink-0">
        <h2 class="text-lg font-black flex items-center gap-2">
          <Tags class="w-5 h-5 text-primary" /> {{ t('tagBulk.title') }}
        </h2>
        <Button variant="ghost" size="icon" @click="handleClose" :disabled="isSubmitting" class="h-8 w-8 rounded-full focus:outline-none">
          <X class="w-4 h-4" />
        </Button>
      </header>

      <div class="p-4 border-b bg-muted/5 shrink-0">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            :placeholder="t('tagBulk.searchPlaceholder')"
            class="pl-9 font-medium bg-background focus-visible:ring-primary"
            :disabled="isSubmitting"
          />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-2 custom-scrollbar relative">
        <div v-if="isSubmitting" class="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <span class="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        </div>

        <p v-if="loading && catalog.length === 0" class="p-8 text-center text-sm text-muted-foreground">
          {{ t('common.loading') }}
        </p>

        <div v-else-if="filtered.length > 0" class="space-y-0.5">
          <button
            v-for="tag in filtered"
            :key="tag.name"
            type="button"
            role="checkbox"
            :aria-checked="stateOf(tag.name) === 'indeterminate' ? 'mixed' : String(stateOf(tag.name))"
            :disabled="isSubmitting"
            class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted active:bg-muted/80 transition-colors text-left disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            @click="cycle(tag.name)"
          >
            <span
              class="size-4 shrink-0 rounded-[4px] border grid place-content-center transition-colors"
              :class="{
                'bg-primary border-primary text-primary-foreground': stateOf(tag.name) === true,
                'bg-primary/50 border-primary text-primary-foreground': stateOf(tag.name) === 'indeterminate',
                'border-input': stateOf(tag.name) === false
              }"
              aria-hidden="true"
            >
              <Minus v-if="stateOf(tag.name) === 'indeterminate'" class="size-3.5" />
              <Check v-else-if="stateOf(tag.name) === true" class="size-3.5" />
            </span>

            <span class="font-bold text-sm truncate flex-1">{{ tag.name }}</span>

            <span
              v-if="baseStateOf(tag.name) === 'some'"
              class="text-[11px] font-bold text-primary shrink-0 tabular-nums"
            >{{ t('tagBulk.partial', { owned: ownedCounts.get(tag.name), total: trackCount }) }}</span>
            <span
              v-else-if="tag.count > 0"
              class="text-[11px] tabular-nums text-muted-foreground shrink-0"
            >{{ tag.count }}</span>
          </button>
        </div>

        <div v-else class="p-8 flex flex-col items-center justify-center text-center">
          <Tags class="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p class="text-sm font-bold text-foreground">
            {{ searchQuery ? t('tagBulk.noMatch') : t('tagBulk.empty') }}
          </p>
          <p class="text-xs text-muted-foreground mt-1">{{ t('tagBulk.createHint') }}</p>
        </div>
      </div>

      <div class="p-4 border-t bg-muted/5 shrink-0">
        <Input
          v-model="newTag"
          :placeholder="t('tagBulk.newPlaceholder')"
          class="font-medium bg-background focus-visible:ring-primary"
          :disabled="isSubmitting"
          @keydown.enter.prevent="submitNewTag"
        />
      </div>

      <footer class="p-3 border-t bg-muted/10 shrink-0 flex items-center justify-between gap-3">
        <p class="text-xs min-w-0 truncate">
          <span class="font-black text-primary">{{ t('common.trackCount', { count: trackCount }) }}</span>
          <span v-if="hasChanges" class="font-medium text-muted-foreground">
            · {{ t('tagBulk.summary', { add: changes.add.length, remove: changes.remove.length }) }}
          </span>
          <span v-else class="font-medium text-muted-foreground"> · {{ t('tagBulk.noChanges') }}</span>
        </p>
        <Button size="sm" class="font-bold shrink-0" :disabled="!hasChanges || isSubmitting" @click="handleApply">
          {{ t('tagBulk.apply') }}
        </Button>
      </footer>

    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--muted)); border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.4); }
</style>
