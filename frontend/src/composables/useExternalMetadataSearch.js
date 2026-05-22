import { ref } from 'vue'
import { useMetadataEditStore } from '@/stores/metadataEdit'
import { notify } from '@/lib/notify'

export const EXTERNAL_MERGE_ALL_MESSAGE =
  '모든 외부 데이터가 로컬 폼으로 병합되었습니다. "변경사항 저장"을 눌러 확정하세요.'

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
    notify.success(EXTERNAL_MERGE_ALL_MESSAGE)
  }

  return { searchMethod, fetchExternal, notifyMergeAll }
}
