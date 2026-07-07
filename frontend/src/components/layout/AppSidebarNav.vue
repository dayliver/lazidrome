<script setup>
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MoreHorizontal } from 'lucide-vue-next'
import AppLogo from '@/components/shared/AppLogo.vue'
import ConnectedDevicesTrigger from '@/components/player/ConnectedDevicesTrigger.vue'
import AppGlobalSearch from '@/components/layout/AppGlobalSearch.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useNavItems } from '@/composables/useNavItems'

defineProps({
  expanded: { type: Boolean, default: true },
})

const emit = defineEmits(['navigate'])

const { t } = useI18n()
const { pinnedItems, overflowItems } = useNavItems()

const onNavigate = () => emit('navigate')
</script>

<template>
  <div class="flex h-16 shrink-0 items-center justify-between gap-2 overflow-hidden whitespace-nowrap px-4 md:px-6">
    <RouterLink
      to="/"
      class="flex min-w-0 items-center text-xl font-black tracking-tighter text-primary"
      @click="onNavigate"
    >
      <AppLogo class="h-6 w-6 transition-all" :class="{ 'mr-3': expanded }" />
      <span v-if="expanded" class="truncate">{{ t('app.name') }}</span>
    </RouterLink>
    <ConnectedDevicesTrigger popover-side="right" popover-align="end" />
  </div>

  <AppGlobalSearch :expanded="expanded" @navigate="onNavigate" />

  <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-2 no-scrollbar">
    <RouterLink
      v-for="item in pinnedItems"
      :key="item.path"
      :to="item.path"
      class="flex items-center rounded-lg p-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      active-class="bg-primary/10 font-bold text-primary hover:text-primary"
      @click="onNavigate"
    >
      <component
        :is="item.icon"
        class="h-5 w-5 shrink-0 transition-all"
        :class="{ 'mr-4': expanded, 'mx-auto': !expanded }"
      />
      <span v-if="expanded" class="text-sm font-bold">{{ item.name }}</span>
    </RouterLink>

    <DropdownMenu v-if="overflowItems.length">
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          class="w-full justify-start rounded-lg p-3 text-muted-foreground hover:bg-muted hover:text-foreground"
          :class="expanded ? '' : 'px-3'"
        >
          <MoreHorizontal
            class="h-5 w-5 shrink-0"
            :class="{ 'mr-4': expanded, 'mx-auto': !expanded }"
          />
          <span v-if="expanded" class="text-sm font-bold">{{ t('nav.more') }}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" class="w-52">
        <DropdownMenuItem v-for="item in overflowItems" :key="item.path" as-child>
          <RouterLink :to="item.path" class="flex w-full items-center gap-2" @click="onNavigate">
            <component :is="item.icon" class="h-4 w-4 shrink-0" />
            <span>{{ item.name }}</span>
          </RouterLink>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </nav>
</template>
