import { watch } from 'vue'
import { i18n } from '@/i18n'
import { t } from '@/i18n/t'
import { APP_NAME, formatAppTitle, setDocumentTitle } from '@/lib/documentTitle'

function applyDocumentTitleForRoute(router) {
  const to = router.currentRoute.value
  if (to.meta.dynamicTitle) return

  const titleKey = to.meta.titleKey
  if (typeof titleKey === 'string') {
    setDocumentTitle(formatAppTitle(t(titleKey)))
    return
  }

  setDocumentTitle(APP_NAME)
}

export function registerDocumentTitle(router) {
  router.afterEach(() => applyDocumentTitleForRoute(router))
  watch(() => i18n.global.locale.value, () => applyDocumentTitleForRoute(router))
}
