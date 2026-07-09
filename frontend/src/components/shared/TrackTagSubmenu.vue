<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu'
import { useTrackTags } from '@/composables/useTrackTags'

const props = defineProps({
  track: { type: Object, required: true },
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

async function onSubOpen(isOpen) {
  if (isOpen) await fetchTags()
}

async function onToggle(tagName) {
  await toggleTag(props.track, tagName)
}

async function submitNew() {
  const added = await addTag(props.track, newTag.value)
  if (added) newTag.value = ''
}

defineExpose({ onSubOpen })
</script>

<template>
  <div class="w-56">
    <div v-if="showSearch" class="p-2 border-b border-border/60">
      <Input
        v-model="filter"
        class="h-8 text-xs"
        :placeholder="t('trackTable.tagsSearch')"
        @keydown.stop
        @click.stop
      />
    </div>

    <div class="max-h-64 overflow-y-auto py-1">
      <p v-if="loading" class="px-3 py-2 text-xs text-muted-foreground">
        {{ t('common.loading') }}
      </p>
      <p v-else-if="filtered.length === 0" class="px-3 py-2 text-xs text-muted-foreground">
        {{ filter ? t('trackTable.tagsNoMatch') : t('trackTable.tagsEmpty') }}
      </p>
      <DropdownMenuCheckboxItem
        v-for="tag in filtered"
        :key="tag.name"
        :checked="hasTag(tag.name)"
        class="text-sm"
        @update:checked="() => onToggle(tag.name)"
        @select.prevent
      >
        <span class="truncate">{{ tag.name }}</span>
        <span v-if="tag.count > 0" class="ml-auto pl-2 text-[10px] tabular-nums text-muted-foreground">
          {{ tag.count }}
        </span>
      </DropdownMenuCheckboxItem>
    </div>

    <div class="p-2 border-t border-border/60">
      <Input
        v-model="newTag"
        class="h-8 text-xs"
        :placeholder="t('trackTable.tagsNewPlaceholder')"
        @keydown.enter.prevent="submitNew"
        @keydown.stop
        @click.stop
      />
    </div>
  </div>
</template>
