<script setup>
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/stores/preferences'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Languages } from 'lucide-vue-next'

const { t } = useI18n()
const prefs = usePreferencesStore()
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Languages class="w-5 h-5 text-primary" />
        {{ t('settings.language.title') }}
      </CardTitle>
      <CardDescription>{{ t('settings.language.description') }}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="flex items-center gap-2">
        <Button
          :variant="prefs.locale === 'en' ? 'default' : 'outline'"
          size="sm"
          :class="prefs.locale === 'en' ? 'font-bold shadow-sm' : ''"
          @click="prefs.setLocale('en')"
        >
          {{ t('settings.language.en') }}
        </Button>
        <Button
          :variant="prefs.locale === 'ko' ? 'default' : 'outline'"
          size="sm"
          :class="prefs.locale === 'ko' ? 'font-bold shadow-sm' : ''"
          @click="prefs.setLocale('ko')"
        >
          {{ t('settings.language.ko') }}
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
