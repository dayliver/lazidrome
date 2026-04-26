import { useTrackListLocalState } from '@/composables/useTrackListLocalState'
import { useTrackListSelection } from '@/composables/useTrackListSelection'
import { useTrackListRowActions } from '@/composables/useTrackListRowActions'

export function useTrackListTable(props) {
  const { localTracks, onDragEnd } = useTrackListLocalState(props)
  const selection = useTrackListSelection(localTracks, props)
  const actions = useTrackListRowActions(localTracks)

  return {
    localTracks,
    onDragEnd,
    ...selection,
    ...actions
  }
}
