<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import ChartRankListRow from '@/components/charts/ChartRankListRow.vue'

const props = defineProps({
  rank: { type: Number, required: true },
  track: { type: Object, required: true },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['play'])

const auth = useAuthStore()

const coverSrc = computed(() => (props.track?.id ? auth.coverSrc('track', props.track.id) : ''))
</script>

<template>
  <ChartRankListRow
    :rank="rank"
    :cover-src="coverSrc"
    cover-type="track"
    cover-variant="track"
    :title="track.title"
    :subtitle="track.artist || '—'"
    :period-listen-sec="track.period_listen_sec"
    :period-plays="track.period_plays"
    :all-time-listen-sec="track.all_time_listen_sec"
    :all-time-plays="track.all_time_plays"
    :rating="track.rating"
    :compact="compact"
    @click="emit('play')"
  />
</template>
