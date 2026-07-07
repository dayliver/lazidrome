<script setup>
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Search, X, Loader2 } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { useGlobalSearch } from '@/composables/useGlobalSearch'

defineProps({
  expanded: { type: Boolean, default: true },
})

const emit = defineEmits(['navigate'])

const { t } = useI18n()
const { query, open, clear } = useGlobalSearch()

function onFocus() {
  open.value = true
}
</script>

<template>
  <div class="shrink-0 px-3 pb-3">
    <div class="relative">
      <Search
        class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        v-model="query"
        type="search"
        :placeholder="expanded ? t('nav.searchPlaceholder') : t('nav.searchShort')"
        class="h-9 bg-muted/40 pl-9 pr-8"
        @focus="onFocus"
      />
      <button
        v-if="query"
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        :aria-label="t('common.cancel')"
        @click="clear(); emit('navigate')"
      >
        <X class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
