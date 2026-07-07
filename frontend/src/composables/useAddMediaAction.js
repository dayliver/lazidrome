import { useRouter } from 'vue-router'
import { isYoutubeUrl } from '@/lib/youtubeUrl'

/**
 * 클립보드에 YouTube URL이 있으면 import, 없으면 upload로 이동.
 */
export function useAddMediaAction() {
  const router = useRouter()

  const goAddMedia = async () => {
    let text = ''
    try {
      text = (await navigator.clipboard.readText())?.trim() ?? ''
    } catch {
      /* clipboard permission denied */
    }

    if (text && isYoutubeUrl(text)) {
      await router.push({ name: 'import', query: { url: text } })
      return
    }
    await router.push({ name: 'upload' })
  }

  return { goAddMedia }
}
