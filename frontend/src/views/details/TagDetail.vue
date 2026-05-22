<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSyncTrackListWithLibrary } from '@/composables/useSyncTrackListWithLibrary'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useAuthStore } from '@/stores/auth'

import { getCoverUrl } from '@/lib/image'

import DetailLayout from '@/components/layout/DetailLayout.vue'
import SectionHeader from '@/components/shared/SectionHeader.vue'
import ArtistListTable from '@/components/shared/ArtistListTable.vue'
import AlbumGrid from '@/components/shared/AlbumGrid.vue'
import TrackListTable from '@/components/shared/TrackListTable.vue'

import { Users, Disc, Music, Hash, Edit } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import TagEditDialog from '@/components/tags/TagEditDialog.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const tagName = computed(() => {
  const raw = route.params.name
  return typeof raw === 'string' ? raw : ''
})

const { data: tagDetail, error: fetchError, isLoading, reload: loadTag } = useAsyncResource(
  () => tagName.value,
  async (name) => {
    if (!name) throw new Error('태그 이름이 없습니다.')
    const qs = new URLSearchParams({ name })
    const res = await auth.fetchWithAuth(`/api/tags/detail?${qs.toString()}`)
    const body = await res.json()
    if (!res.ok) {
      throw new Error(body.error || '태그 정보를 불러오지 못했습니다.')
    }
    const d = body.data || {}
    return {
      artists: d.artists || [],
      albums: d.albums || [],
      tracks: d.tracks || []
    }
  }
)

const artists = computed(() => tagDetail.value?.artists ?? [])
const albums = computed(() => tagDetail.value?.albums ?? [])
const tracks = computed(() => tagDetail.value?.tracks ?? [])

const loadError = computed(() => {
  if (!tagName.value) return '태그 이름이 없습니다.'
  return fetchError.value
})

useSyncTrackListWithLibrary(() => tracks.value)

const editOpen = ref(false)
const imageBust = ref(0)

const imageUrl = computed(() => {
  if (!tagName.value || !auth.serverUrl) return ''
  const base = auth.coverSrc('tag', tagName.value)
  if (!base) return ''
  return `${base}&_cb=${imageBust.value}`
})

const stats = computed(() => [
  { label: '아티스트', value: artists.value.length },
  { label: '앨범', value: albums.value.length },
  { label: '트랙', value: tracks.value.length }
])

const onEditSuccess = ({ renamed, newName, imageUpdated }) => {
  if (renamed && newName) {
    router.replace({ name: 'tag-detail', params: { name: newName } })
    return
  }
  if (imageUpdated) {
    imageBust.value += 1
    void loadTag()
  }
}
</script>

<template>
  <div v-if="isLoading" class="p-16 flex flex-col items-center gap-4 text-muted-foreground">
    <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    <p>태그 정보를 불러오고 있습니다...</p>
  </div>

  <div v-else-if="loadError" class="p-16 text-center text-muted-foreground space-y-4 max-w-lg mx-auto">
    <Hash class="w-12 h-12 mx-auto opacity-30" />
    <p class="font-medium">{{ loadError }}</p>
    <button type="button" class="text-sm font-bold text-primary hover:underline" @click="router.push({ name: 'tags' })">
      태그 목록으로
    </button>
  </div>

  <DetailLayout
    v-else
    :title="tagName"
    subtitle="Tag"
    :is-round-image="false"
    :image-url="imageUrl"
    :stats="stats"
  >
    <template #actions>
      <Button variant="outline" size="sm" @click="editOpen = true">
        <Edit class="w-4 h-4 mr-2" />
        편집
      </Button>
    </template>

    <section v-if="artists.length > 0" class="space-y-6">
      <SectionHeader title="Artists">
        <template #icon>
          <Users class="w-6 h-6 text-primary" />
        </template>
      </SectionHeader>
      <div class="bg-card overflow-hidden border rounded-xl shadow-sm">
        <ArtistListTable :artists="artists" />
      </div>
    </section>

    <section v-if="albums.length > 0" class="space-y-6">
      <SectionHeader title="Albums">
        <template #icon>
          <Disc class="w-6 h-6 text-primary" />
        </template>
      </SectionHeader>
      <AlbumGrid :albums="albums" />
    </section>

    <section v-if="tracks.length > 0" class="space-y-6 pb-12">
      <SectionHeader title="Tracks">
        <template #icon>
          <Music class="w-6 h-6 text-primary" />
        </template>
      </SectionHeader>
      <div class="bg-card overflow-hidden border rounded-xl shadow-sm">
        <TrackListTable :tracks="tracks" />
      </div>
    </section>

    <div
      v-if="!artists.length && !albums.length && !tracks.length"
      class="py-16 text-center border-2 border-dashed rounded-2xl bg-muted/5 text-muted-foreground"
    >
      <p class="font-bold">이 태그를 사용한 아티스트·앨범·트랙이 없습니다.</p>
      <p class="text-sm mt-2">메타데이터에 태그를 추가한 뒤 다시 확인해 주세요.</p>
    </div>
  </DetailLayout>

  <TagEditDialog v-model:is-open="editOpen" :tag-name="tagName" @success="onEditSuccess" />
</template>
