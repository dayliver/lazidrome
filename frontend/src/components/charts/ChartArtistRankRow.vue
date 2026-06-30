<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ChartRankListRow from '@/components/charts/ChartRankListRow.vue'

const props = defineProps({
  rank: { type: Number, required: true },
  artist: { type: Object, required: true },
  compact: { type: Boolean, default: false },
})

const router = useRouter()
const auth = useAuthStore()

const coverSrc = computed(() => (props.artist?.id ? auth.coverSrc('artist', props.artist.id) : ''))

function goToArtist() {
  const id = props.artist?.id
  if (!id) return
  void router.push({ name: 'artist-detail', params: { id } })
}
</script>

<template>
  <ChartRankListRow
    :rank="rank"
    :cover-src="coverSrc"
    cover-type="artist"
    cover-variant="artist"
    :title="artist.name"
    subtitle=""
    :period-plays="artist.period_plays"
    :compact="compact"
    @click="goToArtist"
  />
</template>
