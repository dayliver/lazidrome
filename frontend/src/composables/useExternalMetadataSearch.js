import { ref } from 'vue'
import { useMetadataEditStore } from '@/stores/metadataEdit'
import { notify } from '@/lib/notify'
import { t } from '@/i18n/t'

/**
 * Last.fm 외부 메타데이터 탭 공통: 검색 모드·fetch·병합 완료 토스트
 */
export function useExternalMetadataSearch() {
  const metadataEdit = useMetadataEditStore()
  const searchMethod = ref('text')

  async function fetchExternal({ textValid, onText, mbidValue, mbidMissingMessage }) {
    if (searchMethod.value === 'text') {
      if (!textValid()) return
      await onText()
      return
    }
    const mbid = String(mbidValue ?? '').trim()
    if (!mbid) {
      notify.warning(mbidMissingMessage)
      return
    }
    await metadataEdit.reFetchPreview(null, null, mbid)
  }

  function notifyMergeAll() {
    notify.success(t('external.mergeAllDone'))
  }

  return { searchMethod, fetchExternal, notifyMergeAll }
}
