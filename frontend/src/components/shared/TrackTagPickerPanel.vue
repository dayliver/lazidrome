<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { useTrackTags } from '@/composables/useTrackTags'

const props = defineProps({
  track: { type: Object, required: true },
  active: { type: Boolean, default: true },
})

const { t } = useI18n()
const { loading, fetchTags, sortedTagsForTrack, setTag, addTag } = useTrackTags()

const filter = ref('')
const newTag = ref('')
const applied = ref(new Set())

function syncAppliedFromTrack() {
  const tags = Array.isArray(props.track?.tags) ? props.track.tags : []
  applied.value = new Set(tags.map((name) => String(name)))
}

watch(
  () => [props.track?.id, props.track?.tags],
  () => syncAppliedFromTrack(),
  { immediate: true, deep: true }
)

watch(
  () => props.active,
  (isActive) => {
    if (isActive) {
      syncAppliedFromTrack()
      void fetchTags()
    }
  },
  { immediate: true }
)

const catalog = computed(() => sortedTagsForTrack([...applied.value]))

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return catalog.value
  return catalog.value.filter((tag) => tag.name.toLowerCase().includes(q))
})

const showSearch = computed(() => catalog.value.length >= 12)

function hasTag(name) {
  return applied.value.has(name)
}

async function onToggle(tagName) {
  const name = String(tagName || '').trim()
  if (!name) return
  const next = !applied.value.has(name)
  const prev = applied.value
  const optimistic = new Set(prev)
  if (next) optimistic.add(name)
  else optimistic.delete(name)
  applied.value = optimistic
  try {
    await setTag(props.track, name, next)
    syncAppliedFromTrack()
  } catch (err) {
    applied.value = prev
    console.error('태그 토글 실패:', err)
  }
}

async function submitNew() {
  const name = String(newTag.value || '').trim()
  if (!name) return
  const prev = applied.value
  if (!prev.has(name)) {
    applied.value = new Set(prev).add(name)
  }
  try {
    const added = await addTag(props.track, name)
    if (added) newTag.value = ''
    syncAppliedFromTrack()
  } catch (err) {
    applied.value = prev
    console.error('태그 추가 실패:', err)
  }
}
</script>

<template>
  <div class="w-64 space-y-2">
    <p class="text-xs font-bold uppercase tracking-wide text-muted-foreground px-0.5">
      {{ t('trackTable.tags') }}
    </p>

    <Input
      v-if="showSearch"
      v-model="filter"
      class="h-8 text-xs"
      :placeholder="t('trackTable.tagsSearch')"
    />

    <div class="max-h-56 overflow-y-auto space-y-0.5 -mx-1">
      <p v-if="loading" class="px-2 py-2 text-xs text-muted-foreground">
        {{ t('common.loading') }}
      </p>
      <p v-else-if="filtered.length === 0" class="px-2 py-2 text-xs text-muted-foreground">
        {{ filter ? t('trackTable.tagsNoMatch') : t('trackTable.tagsEmpty') }}
      </p>
      <button
        v-for="tag in filtered"
        :key="tag.name"
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors"
        :class="
          hasTag(tag.name)
            ? 'bg-primary/15 text-primary font-semibold'
            : 'text-foreground hover:bg-muted/80'
        "
        @click="onToggle(tag.name)"
      >
        <span
          class="flex size-4 shrink-0 items-center justify-center rounded-sm border"
          :class="
            hasTag(tag.name)
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background'
          "
          aria-hidden="true"
        >
          <Check v-if="hasTag(tag.name)" class="size-3" />
        </span>
        <span class="truncate flex-1">{{ tag.name }}</span>
        <span
          v-if="tag.count > 0"
          class="text-[10px] tabular-nums shrink-0"
          :class="hasTag(tag.name) ? 'text-primary/70' : 'text-muted-foreground'"
        >
          {{ tag.count }}
        </span>
      </button>
    </div>

    <Input
      v-model="newTag"
      class="h-8 text-xs"
      :placeholder="t('trackTable.tagsNewPlaceholder')"
      @keydown.enter.prevent="submitNew"
    />
  </div>
</template>
