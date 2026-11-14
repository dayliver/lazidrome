<script setup>
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/theme'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Moon, Sun } from 'lucide-vue-next'

const { t } = useI18n()
const theme = useThemeStore()
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <component :is="theme.isDark ? Moon : Sun" class="w-5 h-5 text-primary" />
        {{ t('settings.theme.title') }}
      </CardTitle>
      <CardDescription>{{ t('settings.theme.description') }}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="flex items-center gap-2">
        <Button
          :variant="theme.mode === 'light' ? 'default' : 'outline'"
          size="sm"
          :class="theme.mode === 'light' ? 'font-bold shadow-sm' : ''"
          @click="theme.setMode('light')"
        >
          {{ t('settings.theme.light') }}
        </Button>
        <Button
          :variant="theme.mode === 'dark' ? 'default' : 'outline'"
          size="sm"
          :class="theme.mode === 'dark' ? 'font-bold shadow-sm' : ''"
          @click="theme.setMode('dark')"
        >
          {{ t('settings.theme.dark') }}
        </Button>
        <Button
          :variant="theme.mode === 'system' ? 'default' : 'outline'"
          size="sm"
          :class="theme.mode === 'system' ? 'font-bold shadow-sm' : ''"
          @click="theme.setMode('system')"
        >
          {{ t('settings.theme.system') }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
