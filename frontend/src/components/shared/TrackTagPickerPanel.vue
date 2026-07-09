<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useTrackTags } from '@/composables/useTrackTags'

const props = defineProps({
  track: { type: Object, required: true },
  active: { type: Boolean, default: true },
})

const { t } = useI18n()
const { loading, fetchTags, sortedTagsForTrack, toggleTag, addTag } = useTrackTags()

const filter = ref('')
const newTag = ref('')

const catalog = computed(() => sortedTagsForTrack(props.track?.tags || []))

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return catalog.value
  return catalog.value.filter((tag) => tag.name.toLowerCase().includes(q))
})

const showSearch = computed(() => catalog.value.length >= 12)

function hasTag(name) {
  return (props.track?.tags || []).includes(name)
}

watch(
  () => props.active,
  (isActive) => {
    if (isActive) void fetchTags()
  },
  { immediate: true }
)

async function onToggle(tagName) {
  await toggleTag(props.track, tagName)
}

async function submitNew() {
  const added = await addTag(props.track, newTag.value)
  if (added) newTag.value = ''
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
      <label
        v-for="tag in filtered"
        :key="tag.name"
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/80 cursor-pointer"
      >
        <Checkbox
          :model-value="hasTag(tag.name)"
          @update:model-value="() => onToggle(tag.name)"
        />
        <span class="truncate flex-1">{{ tag.name }}</span>
        <span v-if="tag.count > 0" class="text-[10px] tabular-nums text-muted-foreground shrink-0">
          {{ tag.count }}
        </span>
      </label>
    </div>

    <Input
      v-model="newTag"
      class="h-8 text-xs"
      :placeholder="t('trackTable.tagsNewPlaceholder')"
      @keydown.enter.prevent="submitNew"
    />
  </div>
</template>
