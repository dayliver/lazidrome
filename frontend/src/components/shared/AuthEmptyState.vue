<script setup>
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'

const { t } = useI18n()

defineProps({
  description: { type: String, default: '' },
  actionLabel: { type: String, default: '' },
  actionTo: { type: String, default: '/settings' },
})
</script>

<template>
  <div
    class="rounded-2xl border border-border bg-card/50 p-8 text-center space-y-4"
    role="status"
  >
    <p class="text-muted-foreground">{{ description || t('auth.emptyDefault') }}</p>
    <Button as-child>
      <RouterLink :to="actionTo">{{ actionLabel || t('auth.goSettings') }}</RouterLink>
    </Button>
  </div>
</template>
