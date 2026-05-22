import { useI18n } from 'vue-i18n'
import { formatDuration } from '@/lib/audio'

/** Re-renders when display locale changes (AlbumGrid, detail pages). */
export function useDurationLabel() {
  const { locale } = useI18n()
  return (seconds) => {
    void locale.value
    return formatDuration(seconds)
  }
}
