<script setup>
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'

defineProps({
  description: {
    type: String,
    default: '설정에서 서버에 로그인하면 라이브러리를 사용할 수 있습니다.',
  },
  actionLabel: { type: String, default: '설정으로 이동' },
  actionTo: { type: String, default: '/settings' },
})
</script>

<template>
  <div
    class="rounded-2xl border border-border bg-card/50 p-8 text-center space-y-4"
    role="status"
  >
    <p class="text-muted-foreground">{{ description }}</p>
    <Button as-child>
      <RouterLink :to="actionTo">{{ actionLabel }}</RouterLink>
    </Button>
  </div>
</template>
