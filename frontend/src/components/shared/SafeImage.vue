<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { User, Disc, Music } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()

const props = defineProps({
  /** 직접 URL (기존 호환). signType/signId와 함께 쓰지 않음 */
  src: String,
  /** album | artist | track | tag — 뷰포트 진입 시에만 서명·로드 */
  signType: { type: String, default: '' },
  signId: { type: String, default: '' },
  type: { type: String, default: 'album' },
  alt: { type: String, default: '' },
  class: String,
  /** signType 사용 시 뷰포트 밖 prefetch 여백 */
  rootMargin: { type: String, default: '240px' },
})

const rootEl = ref(null)
const inView = ref(!props.signType || !props.signId)
const hasError = ref(false)

const defaultAlt = computed(() => {
  if (props.alt) return props.alt
  if (props.type === 'artist') return t('safeImage.artist')
  if (props.type === 'album') return t('safeImage.album')
  return t('safeImage.track')
})

const resolvedSrc = computed(() => {
  if (props.signType && props.signId) {
    if (!inView.value) return ''
    return auth.coverSrc(props.signType, props.signId)
  }
  return props.src || ''
})

watch(() => [props.src, props.signType, props.signId], () => {
  hasError.value = false
})

let observer = null

onMounted(() => {
  if (!props.signType || !props.signId || inView.value) return
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) {
        inView.value = true
        observer?.disconnect()
        observer = null
      }
    },
    { rootMargin: props.rootMargin },
  )
  if (rootEl.value) observer.observe(rootEl.value)
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <div
    ref="rootEl"
    :class="['relative overflow-hidden bg-muted flex items-center justify-center', props.class]"
  >
    <img
      v-if="resolvedSrc && !hasError"
      :src="resolvedSrc"
      :alt="defaultAlt"
      loading="lazy"
      decoding="async"
      @error="hasError = true"
      class="absolute inset-0 w-full h-full object-cover"
    />

    <User v-if="type === 'artist'" class="w-1/2 h-1/2 text-muted-foreground/40" />
    <Disc v-else-if="type === 'album'" class="w-1/2 h-1/2 text-muted-foreground/40" />
    <Music v-else class="w-1/2 h-1/2 text-muted-foreground/40" />
  </div>
</template>
