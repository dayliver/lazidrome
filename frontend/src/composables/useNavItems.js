import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Compass,
  Users,
  Disc,
  Music,
  Hash,
  Settings,
  List,
  BarChart2,
  Trophy,
  Wrench,
  FolderOpen,
  Upload,
  History,
} from 'lucide-vue-next'
import {
  NAV_ITEM_DEFS,
  readPinnedNavIds,
  writePinnedNavIds,
  splitNavItems,
  defaultPinnedNavIds,
} from '@/lib/navConfig'

const ICONS = {
  home: Compass,
  artists: Users,
  albums: Disc,
  tracks: Music,
  upload: Upload,
  files: FolderOpen,
  tags: Hash,
  playlists: List,
  charts: Trophy,
  history: History,
  stats: BarChart2,
  admin: Wrench,
  settings: Settings,
}

const pinnedIds = ref(readPinnedNavIds())

export function useNavItems() {
  const { t } = useI18n()

  const mapDef = (def) => ({
    id: def.id,
    path: def.path,
    name: t(def.titleKey),
    icon: ICONS[def.id],
  })

  const pinnedItems = computed(() => {
    void pinnedIds.value
    const { pinned } = splitNavItems(pinnedIds.value)
    return pinned.map(mapDef)
  })

  const overflowItems = computed(() => {
    void pinnedIds.value
    const { overflow } = splitNavItems(pinnedIds.value)
    return overflow.map(mapDef)
  })

  const pinOptions = computed(() =>
    NAV_ITEM_DEFS.map((def) => ({
      id: def.id,
      label: t(def.titleKey),
      pinned: pinnedIds.value.includes(def.id),
      locked: def.id === 'home',
    })),
  )

  const setPinned = (id, value) => {
    if (id === 'home') return
    let next = [...pinnedIds.value]
    if (value) {
      if (!next.includes(id)) next.push(id)
    } else {
      next = next.filter((i) => i !== id)
    }
    pinnedIds.value = next
    writePinnedNavIds(next)
  }

  const reorderPinned = (orderedIds) => {
    const valid = orderedIds.filter((id) => NAV_ITEM_DEFS.some((d) => d.id === id))
    if (!valid.includes('home')) valid.unshift('home')
    pinnedIds.value = valid
    writePinnedNavIds(valid)
  }

  const pinnedPinOptions = computed(() =>
    pinnedIds.value.map((id) => {
      const def = NAV_ITEM_DEFS.find((d) => d.id === id)
      return {
        id,
        label: def ? t(def.titleKey) : id,
        locked: id === 'home',
      }
    }),
  )

  const unpinnedPinOptions = computed(() => {
    const pinnedSet = new Set(pinnedIds.value)
    return NAV_ITEM_DEFS.filter((d) => !pinnedSet.has(d.id)).map((def) => ({
      id: def.id,
      label: t(def.titleKey),
      pinned: false,
      locked: false,
    }))
  })

  const resetPinned = () => {
    pinnedIds.value = defaultPinnedNavIds()
    writePinnedNavIds(pinnedIds.value)
  }

  return {
    pinnedItems,
    overflowItems,
    pinOptions,
    pinnedPinOptions,
    unpinnedPinOptions,
    setPinned,
    reorderPinned,
    resetPinned,
  }
}
