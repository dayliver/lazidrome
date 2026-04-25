<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'
import { getCoverUrl } from '@/lib/image'

// 💉 빠졌던 Users 아이콘 추가
import { Users, Edit } from 'lucide-vue-next'

import { VisXYContainer, VisStackedBar, VisAxis } from '@unovis/vue'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import DetailLayout from '@/components/layout/DetailLayout.vue'

// 💉 공유 UI 컴포넌트들 임포트
import TrackListTable from '@/components/shared/TrackListTable.vue'
import AlbumGrid from '@/components/shared/AlbumGrid.vue'

const route = useRoute()
const library = useLibraryStore()
const auth = useAuthStore()

// TS의 <any> 제거
const artist = ref(null)

const imageUrl = computed(() => {
  if (!artist.value?.id) return ''
  return getCoverUrl(auth.serverUrl, 'artist', artist.value.id, auth.token)
})

const artistStats = computed(() => {
  if (!artist.value?.tracks) return []
  
  const tracks = artist.value.tracks
  // TS의 (t: any) 제거
  const ratedTracks = tracks.filter(t => t.rating > 0)
  const avgRating = ratedTracks.length > 0 
    ? (ratedTracks.reduce((acc, t) => acc + t.rating, 0) / ratedTracks.length).toFixed(1)
    : '0.0'

  return [
    { label: 'Total Tracks', value: tracks.length },
    { label: 'Avg Rating', value: avgRating }
  ]
})

const artistAlbums = computed(() => {
  if (!artist.value?.tracks) return []
  const albumMap = new Map()
  
  // TS의 (t: any) 제거
  artist.value.tracks.forEach(t => {
    if (t.albumId && !albumMap.has(t.albumId)) {
      albumMap.set(t.albumId, {
        id: t.albumId,
        name: t.albumName,
        displayArtist: artist.value.name,
        // 백엔드 artists.js에 방금 추가한 albumCoverType을 매핑합니다.
        cover_type: t.albumCoverType || null 
      })
    }
  })
  return Array.from(albumMap.values())
})

const chartData = computed(() => {
  if (!artist.value) return []
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  artist.value.tracks.forEach(t => {
    if (t.rating > 0) counts[t.rating]++
  })
  return Object.entries(counts).map(([star, count]) => ({ star: `${star}점`, count }))
})

const handleEdit = () => {
  console.log('편집')
}

onMounted(async () => {
  // TS의 'as string' 제거
  artist.value = await library.getArtistById(route.params.id)
})
</script>

<template>
  <DetailLayout 
    v-if="artist" 
    :title="artist.name" 
    subtitle="Artist" 
    :image-url="imageUrl"
    :stats="artistStats"
    :is-round-image="true"
  >
    
    <template #actions>
      <Button variant="outline" size="sm" @click="handleEdit">
        <Edit class="w-4 h-4 mr-2" />
        편집
      </Button>
    </template>
  
    <section v-if="artist.bio" class="max-w-4xl">
      <p class="text-sm md:text-base text-muted-foreground leading-relaxed">
        {{ artist.bio }}
      </p>
    </section>

    <section v-if="artistAlbums.length > 0" class="space-y-6">
      <h2 class="text-2xl font-black tracking-tight border-b pb-2">Albums</h2>
      <AlbumGrid :albums="artistAlbums" />
    </section>

    <section v-if="artist.tracks && artist.tracks.length > 0" class="space-y-6">
      <h2 class="text-2xl font-black tracking-tight border-b pb-2">Popular Tracks</h2>
      <TrackListTable :tracks="artist.tracks" :show-artist="false" />
    </section>

    <section class="space-y-6">
      <h2 class="text-2xl font-black tracking-tight border-b pb-2">Analytics</h2>
      <div class="bg-card border rounded-xl p-6 max-w-md shadow-sm">
        <h3 class="text-sm font-bold text-muted-foreground mb-4">별점 분포 (타율 분석)</h3>
        <ChartContainer :config="{ count: { label: '곡 수', color: 'var(--chart-1)' } }" class="h-[200px]">
          <VisXYContainer :data="chartData">
            <VisStackedBar :x="d => d.star" :y="d => d.count" color="var(--chart-1)" />
            <VisAxis type="x" :grid-line="false" />
            <ChartTooltip />
          </VisXYContainer>
        </ChartContainer>
      </div>
    </section>

    <section class="space-y-6 pb-12">
      <h2 class="text-2xl font-black tracking-tight border-b pb-2">Related Artists</h2>
      <div class="p-12 text-center border-2 border-dashed rounded-xl bg-muted/10 text-muted-foreground flex flex-col items-center gap-2">
        <Users class="w-8 h-8 opacity-50" />
        <span class="text-sm font-medium">향후 추가될 기능입니다 (MusicBrainz 연동 시 제공)</span>
      </div>
    </section>

  </DetailLayout>
</template>