<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { notify } from '@/lib/notify'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { useThemeStore } from '@/stores/theme'
import { usePreferencesStore } from '@/stores/preferences'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sparkles,
  Server,
  RefreshCw,
  LogIn,
  LogOut,
  Moon,
  Sun,
  CheckCircle2,
  Circle,
  Package,
  Languages,
  Globe,
  Menu,
} from 'lucide-vue-next'
import {
  fetchFrontendBuildInfo,
  fetchBackendBuildFromHealth,
  formatBuildTime,
  compareBuilds,
} from '@/lib/buildInfo'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import { Checkbox } from '@/components/ui/checkbox'
import { useNavItems } from '@/composables/useNavItems'
import { VueDraggable } from 'vue-draggable-plus'
import { GripVertical } from 'lucide-vue-next'

const { t } = useI18n()
const auth = useAuthStore()
const library = useLibraryStore()
const theme = useThemeStore()
const prefs = usePreferencesStore()
const { pinnedPinOptions, unpinnedPinOptions, setPinned, reorderPinned, resetPinned } = useNavItems()

const dragPinned = ref([])

watch(
  pinnedPinOptions,
  (items) => {
    dragPinned.value = items.map((item) => ({ ...item }))
  },
  { immediate: true },
)

function onPinnedDragEnd() {
  reorderPinned(dragPinned.value.map((item) => item.id))
}

const adminPassword = ref('')
const settingsLoading = ref(false)

const lastfm = computed(() => library.serverSettings?.lastfm ?? null)
const frontendBuild = ref(null)
const backendBuildRef = ref(null)
const backendBuild = computed(
  () => backendBuildRef.value ?? library.serverSettings?.build ?? null
)
const buildCompare = computed(() => compareBuilds(frontendBuild.value, backendBuild.value))

const buildStatusClass = computed(() => {
  const s = buildCompare.value.status
  if (s === 'ok') return 'text-primary border-primary/30 bg-primary/5'
  if (s === 'mismatch') return 'text-destructive border-destructive/30 bg-destructive/5'
  if (s === 'skew') return 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10'
  return 'text-muted-foreground border-border bg-muted/30'
})

const refreshBackendBuild = async () => {
  backendBuildRef.value = await fetchBackendBuildFromHealth(auth.serverUrl)
}

onMounted(async () => {
  frontendBuild.value = await fetchFrontendBuildInfo()
  void refreshBackendBuild()
})

const loadServerSettings = async () => {
  if (!auth.isAuthenticated) return
  settingsLoading.value = true
  try {
    await library.fetchServerSettings()
    await refreshBackendBuild()
  } catch (e) {
    console.error(e)
  } finally {
    settingsLoading.value = false
  }
}

watch(
  () => auth.isAuthenticated,
  (ok) => {
    if (ok) void loadServerSettings()
    else library.serverSettings = null
  },
  { immediate: true }
)

const handleLogin = async () => {
  const result = await auth.login(adminPassword.value)
  if (result.success) {
    adminPassword.value = ''
    await library.fetchLibrary()
    await loadServerSettings()
  } else {
    notify.error(result.message || t('settings.loginFailed'))
  }
}

const handleLogout = () => {
  if (confirm(t('settings.server.logoutConfirm'))) {
    auth.logout()
  }
}

const handleRefresh = async () => {
  await library.fetchLibrary({ force: true })
  await loadServerSettings()
}
</script>

<template>
  <PageLayout spacing="8">
    <ViewHeader
      :title="t('settings.title')"
      :description="t('settings.subtitle')"
      :show-action="false"
    />

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

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Menu class="w-5 h-5 text-primary" />
          {{ t('settings.navPin.title') }}
        </CardTitle>
        <CardDescription>{{ t('settings.navPin.description') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <p class="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
            {{ t('settings.navPin.pinnedHeading') }}
          </p>
          <p class="text-xs text-muted-foreground px-1">{{ t('settings.navPin.dragHint') }}</p>
          <VueDraggable
            v-model="dragPinned"
            handle=".nav-drag-handle"
            :animation="180"
            class="space-y-2"
            @end="onPinnedDragEnd"
          >
            <div
              v-for="opt in dragPinned"
              :key="opt.id"
              class="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2.5 bg-card"
              :class="opt.locked ? 'opacity-80' : ''"
            >
              <button
                type="button"
                class="nav-drag-handle shrink-0 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
                :class="opt.locked ? 'opacity-30 pointer-events-none' : ''"
                :aria-label="t('settings.navPin.dragHint')"
              >
                <GripVertical class="h-4 w-4" />
              </button>
              <span class="flex-1 text-sm font-medium">{{ opt.label }}</span>
              <Checkbox
                :model-value="true"
                :disabled="opt.locked"
                @update:model-value="(v) => setPinned(opt.id, !!v)"
              />
            </div>
          </VueDraggable>
        </div>

        <div v-if="unpinnedPinOptions.length" class="space-y-2 pt-2 border-t">
          <p class="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
            {{ t('settings.navPin.overflowHeading') }}
          </p>
          <label
            v-for="opt in unpinnedPinOptions"
            :key="opt.id"
            class="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 cursor-pointer hover:bg-muted/40"
          >
            <span class="w-4" />
            <span class="flex-1 text-sm font-medium">{{ opt.label }}</span>
            <Checkbox
              :model-value="false"
              @update:model-value="(v) => setPinned(opt.id, !!v)"
            />
          </label>
        </div>

        <p class="text-xs text-muted-foreground">{{ t('settings.navPin.locked') }}</p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" @click="resetPinned">
          {{ t('settings.navPin.reset') }}
        </Button>
      </CardFooter>
    </Card>

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
          <span v-if="prefs.timezoneMode === 'system'">
            ({{ prefs.systemTimezone }})
          </span>
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Package class="w-5 h-5 text-primary" />
          {{ t('settings.deploy.title') }}
        </CardTitle>
        <CardDescription>{{ t('settings.deploy.description') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid gap-3 sm:grid-cols-2 text-sm">
          <div class="rounded-lg border p-3 bg-muted/20">
            <p class="text-xs font-bold uppercase text-muted-foreground mb-1">{{ t('settings.deploy.frontend') }}</p>
            <p class="font-mono font-semibold">v{{ frontendBuild?.version ?? '—' }}</p>
            <p class="text-muted-foreground text-xs mt-1">
              {{ t('settings.deploy.buildAt', { time: formatBuildTime(frontendBuild?.builtAt) }) }}
            </p>
          </div>
          <div class="rounded-lg border p-3 bg-muted/20">
            <p class="text-xs font-bold uppercase text-muted-foreground mb-1">{{ t('settings.deploy.backend') }}</p>
            <template v-if="!settingsLoading">
              <p class="font-mono font-semibold">v{{ backendBuild?.version ?? '—' }}</p>
              <p class="text-muted-foreground text-xs mt-1">
                {{ t('settings.deploy.deployAt', { time: formatBuildTime(backendBuild?.builtAt) }) }}
              </p>
              <p
                v-if="!backendBuild?.builtAt"
                class="text-xs text-amber-600 dark:text-amber-400 mt-1"
              >
                {{ t('settings.deploy.noBuildInfo') }}
              </p>
            </template>
            <p v-else class="text-xs text-muted-foreground">{{ t('settings.deploy.checking') }}</p>
          </div>
        </div>
        <p class="text-sm rounded-lg border px-3 py-2" :class="buildStatusClass">
          {{ buildCompare.message }}
        </p>
      </CardContent>
    </Card>

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

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2"><Server class="w-5 h-5 text-primary"/> {{ t('settings.server.title') }}</CardTitle>
        <CardDescription>{{ t('settings.server.description') }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label for="url">{{ t('settings.server.url') }}</Label>
          <Input
            id="url"
            v-model="auth.serverUrl"
            placeholder="http://localhost:5294"
          />
          <p class="text-xs text-muted-foreground">{{ t('settings.server.urlHint') }}</p>
        </div>

        <div v-if="!auth.isAuthenticated" class="space-y-2">
          <Label for="pw">{{ t('settings.server.password') }}</Label>
          <div class="flex gap-2">
            <Input id="pw" v-model="adminPassword" type="password" :placeholder="t('settings.server.passwordPlaceholder')" @keyup.enter="handleLogin" />
            <Button @click="handleLogin">
              <LogIn class="w-4 h-4 mr-2"/> {{ t('settings.server.login') }}
            </Button>
          </div>
        </div>

        <div v-else class="p-4 bg-primary/5 rounded-lg border border-primary/20 flex justify-between items-center">
          <div class="flex flex-col">
            <span class="text-xs font-bold text-primary uppercase">{{ t('settings.server.authStatus') }}</span>
            <span class="text-sm font-medium">{{ t('settings.server.connected') }}</span>
          </div>
          <Button variant="outline" size="sm" @click="handleLogout">
            <LogOut class="w-4 h-4 mr-2"/> {{ t('settings.server.logout') }}
          </Button>
        </div>
      </CardContent>
      <CardFooter v-if="auth.isAuthenticated" class="flex items-center justify-between border-t px-6 py-4 bg-muted/10">
        <div class="text-sm font-medium text-muted-foreground">
          {{ t('settings.server.libraryCount', { count: library.trackCount }) }}
        </div>
        <Button @click="handleRefresh" :disabled="library.isSyncing" variant="secondary">
          <RefreshCw class="w-4 h-4 mr-2" :class="{ 'animate-spin': library.isSyncing }" />
          {{ t('settings.server.refresh') }}
        </Button>
      </CardFooter>
    </Card>

    <Card class="border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)]">
      <CardHeader>
        <CardTitle class="flex items-center gap-2"><Sparkles class="w-5 h-5 text-primary"/> {{ t('settings.lastfm.title') }}</CardTitle>
        <CardDescription>{{ t('settings.lastfm.description') }}</CardDescription>
      </CardHeader>
      <CardContent v-if="auth.isAuthenticated" class="space-y-3">
        <p v-if="settingsLoading" class="text-sm text-muted-foreground">{{ t('settings.lastfm.loading') }}</p>
        <template v-else-if="lastfm">
          <div class="flex items-start gap-3 text-sm">
            <CheckCircle2 v-if="lastfm.enrich" class="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <Circle v-else class="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p class="font-medium">{{ t('settings.lastfm.enrich') }}</p>
              <p class="text-muted-foreground text-xs">
                {{ lastfm.enrich ? t('settings.lastfm.enrichOn') : t('settings.lastfm.enrichOff') }}
              </p>
            </div>
          </div>
          <div class="flex items-start gap-3 text-sm">
            <CheckCircle2 v-if="lastfm.scrobble" class="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <Circle v-else class="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p class="font-medium">{{ t('settings.lastfm.scrobble') }}</p>
              <p class="text-muted-foreground text-xs">
                {{ lastfm.scrobble ? t('settings.lastfm.scrobbleOn') : t('settings.lastfm.scrobbleOff') }}
              </p>
            </div>
          </div>
        </template>
        <p class="text-xs text-muted-foreground">{{ t('settings.lastfm.readme') }}</p>
      </CardContent>
      <CardContent v-else class="text-sm text-muted-foreground">
        {{ t('settings.lastfm.loginHint') }}
      </CardContent>
    </Card>

  </PageLayout>
</template>
