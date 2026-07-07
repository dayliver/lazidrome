<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import ImportMetaPicker from '@/components/import/ImportMetaPicker.vue'
import { useLibraryStore } from '@/stores/library'

const PAGE_SIZE = 50

const props = defineProps({
  rows: { type: Array, required: true },
  playlistTitle: { type: String, default: '' },
  rowKey: { type: String, default: 'videoId' },
  showTrackNo: { type: Boolean, default: true },
})

const emit = defineEmits(['update:rows'])

const { t } = useI18n()
const library = useLibraryStore()

const commonArtist = ref('')
const commonAlbum = ref('')
const page = ref(1)
const allArtists = ref([])
const allAlbums = ref([])

const artistOptions = computed(() =>
  allArtists.value.map((a) => ({ id: a.id, name: a.name })),
)

const albumOptions = computed(() =>
  allAlbums.value.map((a) => ({
    id: a.id,
    name: a.name,
    subtitle: a.displayArtist || '',
  })),
)

onMounted(async () => {
  const [artists, albums] = await Promise.all([library.getArtists(), library.getAlbums()])
  allArtists.value = artists || []
  allAlbums.value = albums || []
})

const totalPages = computed(() => Math.max(1, Math.ceil(props.rows.length / PAGE_SIZE)))

const pagedRows = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return props.rows.slice(start, start + PAGE_SIZE)
})

const selectedCount = computed(() => props.rows.filter((r) => r.selected).length)

watch(
  () => props.rows.length,
  () => {
    if (page.value > totalPages.value) page.value = totalPages.value
  },
)

function updateRow(globalIndex, patch) {
  const next = props.rows.map((r, i) => (i === globalIndex ? { ...r, ...patch } : r))
  emit('update:rows', next)
}

function globalIndex(localIdx) {
  return (page.value - 1) * PAGE_SIZE + localIdx
}

function selectAll(value) {
  emit(
    'update:rows',
    props.rows.map((r) => ({ ...r, selected: value })),
  )
}

function applyCommonToSelected() {
  emit(
    'update:rows',
    props.rows.map((r) => {
      if (!r.selected) return r
      return {
        ...r,
        artist: commonArtist.value || r.artist,
        album: commonAlbum.value || r.album,
      }
    }),
  )
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="playlistTitle" class="text-sm text-muted-foreground">
      {{ t('download.playlistTitle', { title: playlistTitle }) }}
    </div>

    <div class="flex flex-wrap items-center gap-2 text-sm">
      <span>{{ t('download.selectedCount', { selected: selectedCount, total: rows.length }) }}</span>
      <Button type="button" variant="outline" size="sm" @click="selectAll(true)">
        {{ t('download.selectAll') }}
      </Button>
      <Button type="button" variant="outline" size="sm" @click="selectAll(false)">
        {{ t('download.selectNone') }}
      </Button>
    </div>

    <div class="rounded-xl border p-4 space-y-3 bg-muted/10">
      <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {{ t('download.commonMeta') }}
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="space-y-1">
          <Label class="text-xs">{{ t('download.fieldArtist') }}</Label>
          <ImportMetaPicker
            v-model="commonArtist"
            :options="artistOptions"
            :placeholder="t('download.fieldArtistHint')"
          />
        </div>
        <div class="space-y-1">
          <Label class="text-xs">{{ t('download.fieldAlbum') }}</Label>
          <ImportMetaPicker
            v-model="commonAlbum"
            :options="albumOptions"
            :placeholder="t('download.fieldAlbumHint')"
          />
        </div>
      </div>
      <Button type="button" variant="secondary" size="sm" @click="applyCommonToSelected">
        {{ t('download.applyCommon') }}
      </Button>
    </div>

    <div class="rounded-xl border overflow-hidden">
      <div class="grid grid-cols-[auto_1fr_1fr_1fr_4rem] gap-2 px-3 py-2 bg-muted/30 text-[10px] font-bold uppercase text-muted-foreground">
        <span></span>
        <span>{{ t('download.fieldTitle') }}</span>
        <span>{{ t('download.fieldArtist') }}</span>
        <span>{{ t('download.fieldAlbum') }}</span>
        <span v-if="showTrackNo" class="text-center">#</span>
      </div>
      <div
        v-for="(row, localIdx) in pagedRows"
        :key="String(row[rowKey] ?? localIdx) + '-' + globalIndex(localIdx)"
        class="grid gap-2 px-3 py-2 border-t items-center text-sm"
        :class="showTrackNo ? 'grid-cols-[auto_1fr_1fr_1fr_4rem]' : 'grid-cols-[auto_1fr_1fr_1fr]'"
      >
        <input
          type="checkbox"
          class="size-4 rounded border"
          :checked="row.selected"
          @change="(e) => updateRow(globalIndex(localIdx), { selected: e.target.checked })"
        />
        <Input
          :model-value="row.title"
          class="h-8 text-xs"
          @update:model-value="(v) => updateRow(globalIndex(localIdx), { title: String(v) })"
        />
        <ImportMetaPicker
          :model-value="row.artist"
          :options="artistOptions"
          :placeholder="t('download.fieldArtistHint')"
          @update:model-value="(v) => updateRow(globalIndex(localIdx), { artist: String(v) })"
        />
        <ImportMetaPicker
          :model-value="row.album"
          :options="albumOptions"
          :placeholder="t('download.fieldAlbumHint')"
          @update:model-value="(v) => updateRow(globalIndex(localIdx), { album: String(v) })"
        />
        <Input
          v-if="showTrackNo"
          :model-value="row.trackNo != null ? String(row.trackNo) : ''"
          class="h-8 text-xs text-center"
          type="number"
          min="1"
          @update:model-value="(v) => updateRow(globalIndex(localIdx), { trackNo: v !== '' && v != null ? Number(v) : null })"
        />
      </div>
    </div>

    <div v-if="totalPages > 1" class="flex items-center justify-center gap-2">
      <Button type="button" variant="outline" size="sm" :disabled="page <= 1" @click="page -= 1">
        {{ t('download.prevPage') }}
      </Button>
      <span class="text-xs text-muted-foreground tabular-nums">
        {{ page }} / {{ totalPages }}
      </span>
      <Button type="button" variant="outline" size="sm" :disabled="page >= totalPages" @click="page += 1">
        {{ t('download.nextPage') }}
      </Button>
    </div>
  </div>
</template>
