<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlaylistStore } from '@/stores/playlist'
import { Button } from '@/components/ui/button'
import { Save, Info, ListMusic, ImageIcon } from 'lucide-vue-next'
import AppEditShell from '@/components/shared/AppEditShell.vue'

// 탭 컴포넌트 임포트 (곧 생성할 예정)
import PlaylistBasicInfoTab from './tabs/PlaylistBasicInfoTab.vue'
import PlaylistTracksTab from './tabs/PlaylistTracksTab.vue'
import CoverArtTab from '@/components/shared/tabs/CoverArtTab.vue' // 💡 shared로 이동 가정
const { t } = useI18n()

const props = defineProps({
  isOpen: Boolean,
  editTarget: { type: Object, default: null }
})
const emit = defineEmits(['update:isOpen', 'success'])

const playlistStore = usePlaylistStore()
const activeTab = ref('basic')
const isSubmitting = ref(false)

// 💡 AlbumMetadataPanel / 메타데이터 편집과 유사한 통합 데이터 구조
const localData = ref({
  name: '',
  description: '',
  type: 'list',
  rules: { match: 'all', conditions: [], sortBy: 'random', limit: 50 },
  playlistTracks: [], // 수동 리스트용 곡 목록
  newCoverFile: null,
  newCoverUrl: null
})

// 초기화 로직 (생성 vs 수정)
watch(() => props.isOpen, (open) => {
  if (open) {
    activeTab.value = 'basic'
    if (props.editTarget) {
      localData.value = {
        ...props.editTarget,
        rules: props.editTarget.rules || { match: 'all', conditions: [], sortBy: 'random', limit: 50 },
        playlistTracks: props.editTarget.tracks || [],
        newCoverFile: null,
        newCoverUrl: null
      }
    } else {
      localData.value = {
        name: '', description: '', type: 'list',
        rules: { match: 'all', conditions: [], sortBy: 'random', limit: 50 },
        playlistTracks: [],
        newCoverFile: null,
        newCoverUrl: null
      }
    }
  }
})

// 💡 스마트 믹스는 곡을 수동으로 관리하지 않으므로 탭에서 제외합니다.
const tabs = computed(() => {
  const base = [{ id: 'basic', label: t('playlist.tabBasic'), icon: Info }]
  if (localData.value.type === 'list') {
    base.push({ id: 'tracks', label: t('playlist.tabTracks'), icon: ListMusic })
  }
  base.push({ id: 'cover', label: t('metadata.tabCover'), icon: ImageIcon })
  return base
})

const handleSave = async () => {
  isSubmitting.value = true
  try {
    let result;
    if (props.editTarget) {
      result = await playlistStore.updatePlaylist(props.editTarget.id, localData.value)
    } else {
      result = await playlistStore.createPlaylist(localData.value)
    }

    if (result) {
      emit('success')
      emit('update:isOpen', false)
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <AppEditShell
    teleport
    :open="isOpen"
    :title="editTarget ? t('playlist.dialogEdit') : t('playlist.dialogCreate')"
    @close="emit('update:isOpen', false)"
  >
    <template #tabs>
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="flex items-center gap-1 min-h-11 py-2 sm:gap-2 sm:py-4 text-sm font-black border-b-2 transition-all whitespace-nowrap focus:outline-none"
        :class="
          activeTab === tab.id
            ? 'border-primary text-primary translate-y-[1px]'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        "
        :aria-pressed="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" class="w-4 h-4" />
        {{ tab.label }}
      </button>
    </template>

    <div v-show="activeTab === 'basic'">
      <PlaylistBasicInfoTab v-model="localData" :is-edit="!!editTarget" />
    </div>
    <div v-show="activeTab === 'tracks'">
      <PlaylistTracksTab v-model="localData.playlistTracks" />
    </div>
    <div v-show="activeTab === 'cover'">
      <CoverArtTab v-model="localData" />
    </div>

    <template #footer>
      <div class="flex w-full justify-end gap-2 sm:gap-3">
        <Button variant="ghost" class="min-h-11 font-bold" @click="emit('update:isOpen', false)">
          {{ t('common.cancel') }}
        </Button>
        <Button class="min-h-11 flex-1 font-black shadow-lg sm:flex-none sm:px-12" :disabled="isSubmitting" @click="handleSave">
          <span
            v-if="isSubmitting"
            class="mr-2 h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full"
          />
          <Save class="w-4 h-4 mr-2" /> {{ t('playlist.saveButton') }}
        </Button>
      </div>
    </template>
  </AppEditShell>
</template>