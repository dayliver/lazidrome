<script setup lang="ts">
import { Home, Library, BarChart2, Settings, Search } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

const navItems = [
  { name: '홈', path: '/', icon: Home },
  { name: '라이브러리', path: '/library', icon: Library },
  { name: '통계', path: '/stats', icon: BarChart2 },
  { name: '설정', path: '/settings', icon: Settings },
]
</script>

<template>
  <nav class="flex items-center justify-between px-6 py-3 border-b bg-background/80 backdrop-blur-md">
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">
        N
      </div>
      <span class="font-bold text-lg tracking-tight">NaviPWA</span>
    </div>

    <div class="flex items-center gap-1">
      <Button variant="ghost" size="icon">
        <Search class="w-5 h-5" />
      </Button>
      <router-link v-for="item in navItems" :key="item.path" :to="item.path">
        <Button variant="ghost" size="sm" class="gap-2 hidden md:flex">
          <component :is="item.icon" class="w-4 h-4" />
          {{ item.name }}
        </Button>
      </router-link>
    </div>
  </nav>
</template>