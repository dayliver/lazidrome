<script setup>
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'
import md5 from 'md5'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Heart } from 'lucide-vue-next'

const router = useRouter()
const library = useLibraryStore()
const auth = useAuthStore()

const activeTab = ref('artists')
const tabData = ref([])
const isLoading = ref(false)

watch([() => library.isDBReady, activeTab], async ([isReady, tab]) => {
  if (!isReady) return
  isLoading.value = true
  
  if (tab === 'artists') tabData.value = await library.getArtists()
  else if (tab === 'albums') tabData.value = await library.getAlbums()
  else if (tab === 'tracks') tabData.value = await library.getTracks()
  else if (tab === 'genres') tabData.value = await library.getGenres()
  else if (tab === 'ratings') tabData.value = await library.getRatings()
  
  isLoading.value = false
}, { immediate: true })

// 💡 수정됨: 토큰을 컴포넌트 렌더링마다 갱신하지 않고, 접속 시 1회만 고정 생성
const authQueryString = computed(() => {
  if (!auth.password || !auth.username) return ''
  const salt = Math.random().toString(36).substring(2, 15)
  const token = md5(auth.password + salt)
  return `u=${auth.username}&t=${token}&s=${salt}&v=1.16.1&c=NaviPWA`
})

const getCoverUrl = (coverId) => {
  if (!coverId) return 'https://via.placeholder.com/50'
  return `${auth.serverUrl}/rest/getCoverArt?id=${coverId}&size=100&${authQueryString.value}`
}

// 💡 추가됨: 재생 시간을 MM:SS로 변환
const formatDuration = (seconds) => {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const renderStars = (rating) => '★'.repeat(rating || 0) + '☆'.repeat(5 - (rating || 0))
</script>

<template>
  <div class="container max-w-6xl py-6 space-y-6">
    <h1 class="text-3xl font-bold tracking-tight">라이브러리</h1>

    <Tabs v-model="activeTab" class="w-full">
      <TabsList class="grid w-full grid-cols-5 mb-6">
        <TabsTrigger value="albums">Albums</TabsTrigger>
        <TabsTrigger value="artists">Artists</TabsTrigger>
        <TabsTrigger value="tracks">Tracks</TabsTrigger>
        <TabsTrigger value="genres">Genres</TabsTrigger>
        <TabsTrigger value="ratings">Ratings</TabsTrigger>
      </TabsList>

      <div class="bg-card border rounded-md shadow-sm overflow-hidden">
        <div v-if="isLoading" class="p-8 text-center text-muted-foreground">데이터를 불러오는 중...</div>
        
        <Table v-else>
          <template v-if="activeTab === 'artists'">
            <TableHeader>
              <TableRow>
                <TableHead>아티스트 이름</TableHead>
                <TableHead class="text-center">관련 곡 수</TableHead>
                <TableHead>대표곡</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in tabData" :key="item.name" class="cursor-pointer hover:bg-muted/50">
                <TableCell class="font-bold">{{ item.name }}</TableCell>
                <TableCell class="text-center">{{ item.trackCount }}곡</TableCell>
                <TableCell class="text-muted-foreground">{{ item.topTrack || '-' }}</TableCell>
              </TableRow>
            </TableBody>
          </template>

          <template v-if="activeTab === 'albums'">
            <TableHeader>
              <TableRow>
                <TableHead class="w-16">커버</TableHead>
                <TableHead>앨범명</TableHead>
                <TableHead>연도</TableHead>
                <TableHead>평균 별점</TableHead>
                <TableHead>곡 수</TableHead>
                <TableHead>대표곡</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in tabData" :key="item.album">
                <TableCell>
                  <img :src="getCoverUrl(item.coverArt)" crossorigin="anonymous" class="w-10 h-10 rounded-md object-cover" />
                </TableCell>
                <TableCell class="font-bold">
                  {{ item.album }}
                  <Heart v-if="item.hasStarred" class="inline w-4 h-4 ml-2 text-red-500 fill-current" />
                </TableCell>
                <TableCell>{{ item.year || '-' }}</TableCell>
                <TableCell class="text-yellow-500">{{ item.avgRating ? item.avgRating + '점' : '-' }}</TableCell>
                <TableCell>{{ item.trackCount }}곡</TableCell>
                <TableCell class="text-sm text-muted-foreground truncate max-w-[200px]">{{ item.topTrack }}</TableCell>
              </TableRow>
            </TableBody>
          </template>

          <template v-if="activeTab === 'tracks'">
            <TableHeader>
              <TableRow>
                <TableHead class="w-16">커버</TableHead>
                <TableHead>제목</TableHead>
                <TableHead>시간</TableHead> <TableHead>연도</TableHead>
                <TableHead>별점</TableHead>
                <TableHead>재생 횟수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in tabData" :key="item.id">
                <TableCell>
                  <img :src="getCoverUrl(item.coverArt)" crossorigin="anonymous" class="w-10 h-10 rounded-md object-cover" />
                </TableCell>
                <TableCell class="font-medium">
                  {{ item.title }}
                  <Heart v-if="item.starred" class="inline w-4 h-4 ml-2 text-red-500 fill-current" />
                </TableCell>
                <TableCell class="text-muted-foreground">{{ formatDuration(item.duration) }}</TableCell> <TableCell>{{ item.year || '-' }}</TableCell>
                <TableCell class="text-yellow-500 tracking-widest">{{ renderStars(item.rating) }}</TableCell>
                <TableCell class="text-primary font-semibold">{{ item.playCount }}회</TableCell>
              </TableRow>
            </TableBody>
          </template>

          <template v-if="activeTab === 'genres' || activeTab === 'ratings'">
            <TableHeader>
              <TableRow>
                <TableHead>{{ activeTab === 'genres' ? '장르' : '별점' }}</TableHead>
                <TableHead>곡 수</TableHead>
                <TableHead>대표곡</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="item in tabData" :key="item.genre || item.rating">
                <TableCell class="font-bold">
                  <span v-if="activeTab === 'ratings'" class="text-yellow-500 tracking-widest">
                    {{ item.rating === 0 ? '평가 없음 (Unrated)' : renderStars(item.rating) }}
                  </span>
                  <span v-else>{{ item.genre }}</span>
                </TableCell>
                <TableCell>{{ item.trackCount }}곡</TableCell>
                <TableCell class="text-muted-foreground">{{ item.topTrack }}</TableCell>
              </TableRow>
            </TableBody>
          </template>
        </Table>
      </div>
    </Tabs>
  </div>
</template>