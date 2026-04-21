<script setup>
import { onMounted, ref } from 'vue'
import { RouterView, RouterLink } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth' // 💉 추가됨
import PlayerWrapper from '@/components/player/PlayerWrapper.vue'
import { Button } from '@/components/ui/button'
import { Menu, X, Compass, Users, Disc, Music, Hash, Settings } from 'lucide-vue-next'
import MetadataReviewer from '@/components/ui/MetadataReviewer.vue'

const library = useLibraryStore()
const player = usePlayerStore()
const auth = useAuthStore() // 💉 추가됨

// 상태 관리
const isSidebarExpanded = ref(true)
const isMobileMenuOpen = ref(false)

const navItems = [
  { name: 'Artists', path: '/artists', icon: Users },
  { name: 'Albums', path: '/albums', icon: Disc },
  { name: 'Tracks', path: '/tracks', icon: Music },
  { name: 'Tags', path: '/tags', icon: Hash },
  { name: 'Settings', path: '/settings', icon: Settings }
]

onMounted(async () => {
  // 인증된 상태라면 서버에서 라이브러리 데이터를 가져옵니다.
  if (auth.isAuthenticated) {
    await library.fetchLibrary()
  }
  player.initAudio()
})
</script>

<template>
  <div class="flex flex-col md:flex-row h-screen w-full bg-background text-foreground overflow-hidden relative">
    
    <aside 
      class="hidden md:flex flex-col border-r bg-card transition-all duration-300 relative z-50"
      :class="[isSidebarExpanded ? 'w-60' : 'w-20']"
    >
      <div class="p-6 h-16 flex items-center overflow-hidden whitespace-nowrap">
        <RouterLink to="/" class="flex items-center text-xl font-black tracking-tighter text-primary">
          <Compass class="w-6 h-6 shrink-0 transition-all" :class="{ 'mr-3': isSidebarExpanded }" />
          <span v-if="isSidebarExpanded">LAZIDROME</span>
        </RouterLink>
      </div>

      <nav class="flex-1 px-3 py-4 space-y-2 overflow-y-auto no-scrollbar">
        <RouterLink 
          v-for="item in navItems" 
          :key="item.name"
          :to="item.path"
          class="flex items-center p-3 rounded-lg hover:bg-muted transition-colors group text-muted-foreground hover:text-foreground"
          active-class="bg-primary/10 text-primary hover:text-primary font-bold"
        >
          <component :is="item.icon" class="w-5 h-5 shrink-0 transition-all" :class="{ 'mr-4': isSidebarExpanded, 'mx-auto': !isSidebarExpanded }" />
          <span v-if="isSidebarExpanded" class="font-bold text-sm">{{ item.name }}</span>
        </RouterLink>
      </nav>

      <div class="shrink-0 border-t bg-card/50 backdrop-blur-md">
        <div id="desktop-player-portal"></div>
      </div>
    </aside>

    <header class="md:hidden border-b px-4 h-14 flex items-center justify-between bg-card/95 backdrop-blur-md z-50 shrink-0 relative">
      <RouterLink to="/" class="flex items-center text-lg font-black tracking-tighter text-primary" @click="isMobileMenuOpen = false">
        <Compass class="w-5 h-5 mr-2" />
        LAZIDROME
      </RouterLink>
      <Button variant="ghost" size="icon" @click="isMobileMenuOpen = !isMobileMenuOpen">
        <component :is="isMobileMenuOpen ? X : Menu" class="w-6 h-6 transition-transform" />
      </Button>
    </header>

    <Transition name="slide-down">
      <nav v-if="isMobileMenuOpen" class="md:hidden absolute top-14 left-0 w-full bg-card/95 backdrop-blur-xl border-b z-40 px-4 py-4 shadow-2xl flex flex-col gap-2">
        <RouterLink 
          v-for="item in navItems" 
          :key="item.name" 
          :to="item.path" 
          class="flex items-center p-4 rounded-xl text-muted-foreground hover:bg-muted transition-colors font-bold"
          active-class="bg-primary/10 text-primary"
          @click="isMobileMenuOpen = false"
        >
          <component :is="item.icon" class="w-6 h-6 mr-4 shrink-0" />
          {{ item.name }}
        </RouterLink>
      </nav>
    </Transition>

    <main class="flex-1 overflow-y-auto relative bg-background">
      <div class="mx-auto max-w-full px-4 md:px-12 py-6 md:py-10">
        <RouterView />
      </div>

      <Transition name="fade">
        <div v-if="isMobileMenuOpen" 
             class="md:hidden absolute inset-0 z-30 bg-background/60 backdrop-blur-sm"
             @click="isMobileMenuOpen = false">
        </div>
      </Transition>
    </main>

    <PlayerWrapper :is-sidebar-expanded="isSidebarExpanded" />

    <MetadataReviewer />

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