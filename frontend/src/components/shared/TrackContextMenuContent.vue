<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Heart,
  Tag,
  Disc,
  Users,
  ListMusic,
  ListPlus,
  Sparkles,
  Trash2,
} from 'lucide-vue-next'
import TrackTagSubmenu from '@/components/shared/TrackTagSubmenu.vue'

const props = defineProps({
  track: { type: Object, required: true },
  showArtist: { type: Boolean, default: true },
  showAlbum: { type: Boolean, default: true },
  playlistId: { type: String, default: null },
  toggleStar: { type: Function, required: true },
  updateRating: { type: Function, required: true },
  goToTrack: { type: Function, required: true },
  goToAlbum: { type: Function, required: true },
  goToArtist: { type: Function, required: true },
  openPlaylistModal: { type: Function, required: true },
  removeTrackFromPlaylist: { type: Function, default: null },
  fetchMetadata: { type: Function, required: true },
})

const { t } = useI18n()
const tagSubmenuRef = ref(null)

async function onToggleStar(checked) {
  if (!!props.track.starred !== checked) {
    await props.toggleStar(props.track)
  }
}

function onRating(star) {
  props.updateRating(props.track, star)
}

function onTagsSubOpen(isOpen) {
  tagSubmenuRef.value?.onSubOpen?.(isOpen)
}
</script>

<template>
  <DropdownMenuCheckboxItem
    :checked="!!track.starred"
    @update:checked="onToggleStar"
    @select.prevent
  >
    <Heart class="mr-2 h-4 w-4" :class="track.starred ? 'text-red-500 fill-current' : ''" />
    {{ t('trackTable.favorite') }}
  </DropdownMenuCheckboxItem>

  <div class="px-2 py-1.5" @pointerdown.stop>
    <div class="flex items-center justify-center gap-0.5" role="group" :aria-label="t('trackTable.rating')">
      <button
        v-for="star in 5"
        :key="star"
        type="button"
        class="p-0.5 text-lg leading-none transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        :class="star <= (track.rating || 0) ? 'text-yellow-500' : 'text-muted-foreground/40'"
        @click="onRating(star)"
      >
        ★
      </button>
    </div>
  </div>

  <DropdownMenuSeparator />

  <DropdownMenuSub @update:open="onTagsSubOpen">
    <DropdownMenuSubTrigger>
      <Tag class="mr-2 h-4 w-4" />
      {{ t('trackTable.tags') }}
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent class="p-0">
      <TrackTagSubmenu ref="tagSubmenuRef" :track="track" />
    </DropdownMenuSubContent>
  </DropdownMenuSub>

  <DropdownMenuSeparator />

  <DropdownMenuItem @select="() => goToTrack(track.id)">
    <ListMusic class="mr-2 h-4 w-4" />
    {{ t('trackTable.goToTrack') }}
  </DropdownMenuItem>

  <template v-if="playlistId && track.playlist_track_id">
    <DropdownMenuSeparator />
    <DropdownMenuItem
      class="text-red-500 focus:text-red-500 focus:bg-red-500/10"
      @select="() => removeTrackFromPlaylist?.(track.playlist_track_id, track.title)"
    >
      <Trash2 class="mr-2 h-4 w-4" />
      {{ t('trackTable.removeFromPlaylistMenu') }}
    </DropdownMenuItem>
  </template>

  <DropdownMenuSeparator />

  <DropdownMenuItem @select="() => openPlaylistModal(track.id)">
    <ListMusic class="mr-2 h-4 w-4 text-primary" />
    {{ t('trackTable.addToPlaylist') }}
  </DropdownMenuItem>

  <DropdownMenuItem v-if="showAlbum" @select="() => goToAlbum(track.albumId)">
    <Disc class="mr-2 h-4 w-4" />
    {{ t('trackTable.goToAlbum') }}
  </DropdownMenuItem>

  <DropdownMenuItem v-if="showArtist" @select="() => goToArtist(track.artist)">
    <Users class="mr-2 h-4 w-4" />
    {{ t('trackTable.goToArtist') }}
  </DropdownMenuItem>

  <DropdownMenuItem>
    <ListPlus class="mr-2 h-4 w-4" />
    {{ t('trackTable.playNext') }}
  </DropdownMenuItem>

  <DropdownMenuSeparator />

  <DropdownMenuItem @select="() => fetchMetadata(track.id)">
    <Sparkles class="mr-2 h-4 w-4 text-yellow-500" />
    {{ t('trackTable.updateMetadata') }}
  </DropdownMenuItem>
</template>
