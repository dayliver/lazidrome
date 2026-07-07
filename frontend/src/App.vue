<script setup>
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, RouterLink } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { usePlaybackSyncStore } from '@/stores/playbackSync.js'
import { useAuthStore } from '@/stores/auth'
import PlayerWrapper from '@/components/player/PlayerWrapper.vue'
import AppSidebarNav from '@/components/layout/AppSidebarNav.vue'
import AppGlobalSearch from '@/components/layout/AppGlobalSearch.vue'
import AppSearchPanel from '@/components/layout/AppSearchPanel.vue'
import AppLogo from '@/components/shared/AppLogo.vue'
import ConnectedDevicesTrigger from '@/components/player/ConnectedDevicesTrigger.vue'
import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-vue-next'
import MetadataEditDialog from '@/components/metadata/MetadataEditDialog.vue'
import { useYoutubePaste } from '@/composables/useYoutubePaste'
import { useNavItems } from '@/composables/useNavItems'

import 'vue-sonner/style.css'
import { Toaster } from '@/components/ui/sonner'

const { t } = useI18n()
const library = useLibraryStore()
const player = usePlayerStore()
const auth = useAuthStore()
const playbackSync = usePlaybackSyncStore()
const { pinnedItems, overflowItems } = useNavItems()

const isSidebarExpanded = ref(true)
const isMobileMenuOpen = ref(false)

useYoutubePaste()

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

onMounted(async () => {
  if (auth.isAuthenticated) {
    await library.fetchLibrary()
    await player.restoreQueueFromStorage()
    playbackSync.start()
  }
  player.initAudio()
  player.beginPersistingQueue()
})

watch(
  () => auth.token,
  async (t, prev) => {
    if (t && !prev) {
      await library.fetchLibrary()
      await player.restoreQueueFromStorage()
      player.beginPersistingQueue()
      playbackSync.start()
    }
    if (!t && prev) {
      library.clearLibrarySession()
      playbackSync.stop()
    }
  }
)
</script>

<template>
  <div class="flex flex-col md:flex-row h-screen w-full bg-background text-foreground overflow-hidden relative">
    <aside
      class="hidden md:flex flex-col border-r bg-card transition-all duration-300 relative z-50"
      :class="[isSidebarExpanded ? 'w-[17rem]' : 'w-[5.5rem]']"
    >
      <AppSidebarNav :expanded="isSidebarExpanded" />

      <div class="shrink-0 border-t bg-card/50 backdrop-blur-md">
        <div id="desktop-player-portal"></div>
      </div>
    </aside>

    <header class="md:hidden border-b px-4 h-14 flex items-center justify-between bg-card/95 backdrop-blur-md z-50 shrink-0 relative">
      <RouterLink
        to="/"
        class="flex min-w-0 items-center text-lg font-black tracking-tighter text-primary"
        @click="closeMobileMenu"
      >
        <AppLogo class="w-5 h-5 mr-2" />
        <span class="truncate">{{ t('app.name') }}</span>
      </RouterLink>
      <div class="flex shrink-0 items-center gap-1">
        <ConnectedDevicesTrigger popover-side="bottom" popover-align="end" />
        <Button
          variant="ghost"
          size="icon"
          :aria-label="isMobileMenuOpen ? t('nav.menuClose') : t('nav.menuOpen')"
          @click="isMobileMenuOpen = !isMobileMenuOpen"
        >
          <component :is="isMobileMenuOpen ? X : Menu" class="w-6 h-6 transition-transform" />
        </Button>
      </div>
    </header>

    <Transition name="slide-down">
      <nav
        v-if="isMobileMenuOpen"
        class="md:hidden absolute top-14 left-0 w-full max-h-[calc(100vh-3.5rem)] overflow-y-auto bg-card/95 backdrop-blur-xl border-b z-40 px-4 py-4 shadow-2xl flex flex-col gap-2"
      >
        <AppGlobalSearch expanded @navigate="closeMobileMenu" />

        <RouterLink
          v-for="item in pinnedItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center p-4 rounded-xl text-muted-foreground hover:bg-muted transition-colors font-bold"
          active-class="bg-primary/10 text-primary"
          @click="closeMobileMenu"
        >
          <component :is="item.icon" class="w-6 h-6 mr-4 shrink-0" />
          {{ item.name }}
        </RouterLink>

        <template v-if="overflowItems.length">
          <p class="px-2 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {{ t('nav.more') }}
          </p>
          <RouterLink
            v-for="item in overflowItems"
            :key="item.path"
            :to="item.path"
            class="flex items-center p-4 rounded-xl text-muted-foreground hover:bg-muted transition-colors font-bold"
            active-class="bg-primary/10 text-primary"
            @click="closeMobileMenu"
          >
            <component :is="item.icon" class="w-6 h-6 mr-4 shrink-0" />
            {{ item.name }}
          </RouterLink>
        </template>
      </nav>
    </Transition>

    <main class="flex-1 overflow-y-auto relative bg-background">
      <AppSearchPanel @navigate="closeMobileMenu" />
      <div
        class="mx-auto max-w-full px-4 pt-6 pb-[calc(5.75rem+env(safe-area-inset-bottom,0px)+1.25rem)] md:px-12 md:py-10"
      >
        <RouterView />
      </div>

      <Transition name="fade">
        <div
          v-if="isMobileMenuOpen"
          class="md:hidden absolute inset-0 z-30 bg-background/60 backdrop-blur-sm"
          @click="closeMobileMenu"
        />
      </Transition>
    </main>

    <PlayerWrapper :is-sidebar-expanded="isSidebarExpanded" />

    <MetadataEditDialog />

    <Toaster />
  </div>
</template>

<style>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.slide-down-enter-from, .slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
