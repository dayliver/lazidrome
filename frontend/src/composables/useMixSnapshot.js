import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useLibraryStore } from '@/stores/library'
import {
  hashMixRules,
  loadMixSnapshot,
  saveMixSnapshot,
  removeMixSnapshot,
  isMixSnapshotValid,
} from '@/lib/mixSnapshot'

export function useMixSnapshot() {
  const library = useLibraryStore()
  const { t } = useI18n()

  const isResolving = ref(false)

  async function hydrateTrackIds(trackIds) {
    const list = [...new Set((trackIds || []).map(String).filter(Boolean))]
    if (!list.length) return []
    const items = await library.fetchTracksByIds(list)
    const byId = new Map(items.map((track) => [String(track.id), track]))
    return list.map((id) => byId.get(String(id))).filter(Boolean)
  }

  function persistFresh(playlistId, rulesHash, tracks) {
    saveMixSnapshot(playlistId, {
      rulesHash,
      trackIds: (tracks || []).map((track) => track.id),
    })
  }

  async function applySnapshotTracks(playlistId, snapshot, rulesHash, freshTracks) {
    let tracks = await hydrateTrackIds(snapshot.trackIds)
    const removed = snapshot.trackIds.length - tracks.length

    if (!tracks.length) {
      toast.warning(t('playlist.mixSnapshotEmpty'))
      tracks = freshTracks || []
      persistFresh(playlistId, rulesHash, tracks)
      return tracks
    }

    if (removed > 0) {
      toast.info(t('playlist.mixSnapshotTracksRemoved', { count: removed }))
      saveMixSnapshot(playlistId, {
        rulesHash,
        trackIds: tracks.map((track) => track.id),
      })
    }

    return tracks
  }

  /**
   * mix 상세 로드 후 트랙 목록 결정.
   * @param {object} playlist API playlist (type mix, tracks = fresh server result)
   * @param {{ forceFresh?: boolean }} [options]
   */
  async function resolveMixTracks(playlist, { forceFresh = false } = {}) {
    if (!playlist || playlist.type !== 'mix') {
      return playlist?.tracks || []
    }

    isResolving.value = true
    try {
      const rulesHash = hashMixRules(playlist.rules)
      const freshTracks = playlist.tracks || []

      let snapshot = loadMixSnapshot(playlist.id)
      if (snapshot && snapshot.rulesHash !== rulesHash) {
        removeMixSnapshot(playlist.id)
        snapshot = null
        if (!forceFresh) {
          toast.info(t('playlist.mixSnapshotRulesChanged'))
        }
      }

      if (forceFresh || !isMixSnapshotValid(snapshot, rulesHash)) {
        persistFresh(playlist.id, rulesHash, freshTracks)
        return freshTracks
      }

      return await applySnapshotTracks(playlist.id, snapshot, rulesHash, freshTracks)
    } finally {
      isResolving.value = false
    }
  }

  return {
    isResolving,
    resolveMixTracks,
  }
}
