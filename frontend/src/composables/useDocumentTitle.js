import { watch, toValue } from 'vue'
import { setDocumentTitle } from '@/lib/documentTitle'

/** Ref/computed/string getter → document.title (+ og/twitter:title) */
export function useDocumentTitle(source) {
  watch(
    () => toValue(source),
    (title) => {
      if (title) setDocumentTitle(title)
    },
    { immediate: true },
  )
}
