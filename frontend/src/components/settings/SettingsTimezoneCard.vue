<script setup>
import { useI18n } from 'vue-i18n'
import { usePreferencesStore } from '@/stores/preferences'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Globe } from 'lucide-vue-next'

const { t } = useI18n()
const prefs = usePreferencesStore()
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Globe class="w-5 h-5 text-primary" />
        {{ t('settings.timezone.title') }}
      </CardTitle>
      <CardDescription>{{ t('settings.timezone.description') }}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <Button
          :variant="prefs.timezoneMode === 'system' ? 'default' : 'outline'"
          size="sm"
          :class="prefs.timezoneMode === 'system' ? 'font-bold shadow-sm' : ''"
          @click="prefs.setTimezoneMode('system')"
        >
          {{ t('settings.timezone.system') }}
        </Button>
        <Button
          :variant="prefs.timezoneMode === 'custom' ? 'default' : 'outline'"
          size="sm"
          :class="prefs.timezoneMode === 'custom' ? 'font-bold shadow-sm' : ''"
          @click="prefs.setTimezoneMode('custom')"
        >
          {{ t('settings.timezone.custom') }}
        </Button>
      </div>
      <div v-if="prefs.timezoneMode === 'custom'" class="space-y-2">
        <Label>{{ t('settings.timezone.custom') }}</Label>
        <Select
          :model-value="prefs.customTimezone"
          @update:model-value="(v) => prefs.setCustomTimezone(String(v))"
        >
          <SelectTrigger class="w-full max-w-md font-mono text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent class="max-h-72">
            <SelectItem
              v-for="tz in prefs.timezoneOptions"
              :key="tz"
              :value="tz"
              class="font-mono text-sm"
            >
              {{ tz }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p class="text-xs text-muted-foreground">
        {{ t('settings.timezone.current', { zone: prefs.effectiveTimezone }) }}
        <span v-if="prefs.timezoneMode === 'system'"> ({{ prefs.systemTimezone }}) </span>
      </p>
    </CardContent>
  </Card>
</template>
