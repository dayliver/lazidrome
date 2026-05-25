<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { notify } from '@/lib/notify'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Wrench, Disc, Users, RefreshCw, Trash2, ShieldAlert } from 'lucide-vue-next'

const { t } = useI18n()
const auth = useAuthStore()
const library = useLibraryStore()

const isLoading = ref(false)
const isCleaning = ref(false)
const emptyAlbums = ref({ total: 0, items: [] })
const orphanArtists = ref({ total: 0, items: [] })

const totalOrphans = computed(
  () => (emptyAlbums.value.total ?? 0) + (orphanArtists.value.total ?? 0),
)

const fetchOrphans = async () => {
  if (!auth.isAuthenticated) return
  isLoading.value = true
  try {
    const res = await auth.fetchWithAuth('/api/admin/db/orphans')
    if (!res.ok) throw new Error('orphan fetch failed')
    const body = await res.json()
    emptyAlbums.value = body.emptyAlbums || { total: 0, items: [] }
    orphanArtists.value = body.orphanArtists || { total: 0, items: [] }
  } catch (err) {
    console.error(err)
    notify.error(t('admin.fetchFailed'))
  } finally {
    isLoading.value = false
  }
}

const runCleanup = async () => {
  if (!totalOrphans.value) return
  if (!confirm(t('admin.cleanupConfirm', { count: totalOrphans.value }))) return
  isCleaning.value = true
  try {
    const res = await auth.fetchWithAuth('/api/admin/db/cleanup', { method: 'POST' })
    if (!res.ok) throw new Error('cleanup failed')
    const body = await res.json()
    notify.success(
      t('admin.cleanupDone', {
        albums: body.albumsRemoved ?? 0,
        artists: body.artistsRemoved ?? 0,
      }),
    )
    await fetchOrphans()
    // 라이브러리 목록 동기화 (앨범/아티스트 사라졌을 수 있음).
    await library.fetchLibrary()
  } catch (err) {
    console.error(err)
    notify.error(t('admin.cleanupFailed'))
  } finally {
    isCleaning.value = false
  }
}

onMounted(() => {
  void fetchOrphans()
})
</script>

<template>
  <div class="container max-w-3xl py-10 space-y-8">

    <div class="space-y-2">
      <h1 class="text-3xl font-black tracking-tight flex items-center gap-3">
        <Wrench class="w-7 h-7 text-primary" />
        {{ t('admin.title') }}
      </h1>
      <p class="text-muted-foreground">{{ t('admin.subtitle') }}</p>
    </div>

    <div
      v-if="!auth.isAuthenticated"
      class="rounded-xl border-2 border-dashed p-10 text-center text-muted-foreground space-y-3"
    >
      <ShieldAlert class="w-10 h-10 mx-auto opacity-40" />
      <p class="font-medium">{{ t('admin.authRequired') }}</p>
    </div>

    <template v-else>
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Disc class="w-5 h-5 text-primary" />
            {{ t('admin.emptyAlbums.title') }}
          </CardTitle>
          <CardDescription>{{ t('admin.emptyAlbums.description') }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <p v-if="isLoading" class="text-sm text-muted-foreground">{{ t('admin.loading') }}</p>
          <template v-else>
            <p class="text-sm">
              <span class="font-bold text-lg">{{ emptyAlbums.total }}</span>
              <span class="text-muted-foreground ml-1">{{ t('admin.emptyAlbums.count') }}</span>
            </p>
            <div
              v-if="emptyAlbums.items.length"
              class="rounded-lg border bg-muted/10 max-h-72 overflow-auto divide-y text-sm"
            >
              <div
                v-for="row in emptyAlbums.items"
                :key="row.id"
                class="px-3 py-2 flex items-center gap-3"
              >
                <span class="flex-1 font-medium truncate" :title="row.name">{{ row.name }}</span>
                <span v-if="row.year" class="text-xs text-muted-foreground font-mono">{{ row.year }}</span>
                <span class="text-[10px] text-muted-foreground font-mono opacity-60">{{ row.id }}</span>
              </div>
            </div>
            <p
              v-if="emptyAlbums.total > emptyAlbums.items.length"
              class="text-xs text-muted-foreground"
            >
              {{ t('admin.truncated', { shown: emptyAlbums.items.length, total: emptyAlbums.total }) }}
            </p>
          </template>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Users class="w-5 h-5 text-primary" />
            {{ t('admin.orphanArtists.title') }}
          </CardTitle>
          <CardDescription>{{ t('admin.orphanArtists.description') }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <p v-if="isLoading" class="text-sm text-muted-foreground">{{ t('admin.loading') }}</p>
          <template v-else>
            <p class="text-sm">
              <span class="font-bold text-lg">{{ orphanArtists.total }}</span>
              <span class="text-muted-foreground ml-1">{{ t('admin.orphanArtists.count') }}</span>
            </p>
            <div
              v-if="orphanArtists.items.length"
              class="rounded-lg border bg-muted/10 max-h-72 overflow-auto divide-y text-sm"
            >
              <div
                v-for="row in orphanArtists.items"
                :key="row.id"
                class="px-3 py-2 flex items-center gap-3"
              >
                <span class="flex-1 font-medium truncate" :title="row.name">{{ row.name }}</span>
                <span class="text-[10px] text-muted-foreground font-mono opacity-60">{{ row.id }}</span>
              </div>
            </div>
            <p
              v-if="orphanArtists.total > orphanArtists.items.length"
              class="text-xs text-muted-foreground"
            >
              {{ t('admin.truncated', { shown: orphanArtists.items.length, total: orphanArtists.total }) }}
            </p>
          </template>
        </CardContent>
      </Card>

      <div
        class="sticky bottom-4 rounded-xl border bg-card/95 backdrop-blur-md shadow-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3"
      >
        <p class="text-xs text-muted-foreground max-w-md">{{ t('admin.cleanupHint') }}</p>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" :disabled="isLoading" @click="fetchOrphans">
            <RefreshCw class="w-4 h-4 mr-2" :class="{ 'animate-spin': isLoading }" />
            {{ t('admin.refresh') }}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            :disabled="isCleaning || totalOrphans === 0"
            @click="runCleanup"
          >
            <Trash2 class="w-4 h-4 mr-2" :class="{ 'animate-spin': isCleaning }" />
            {{ t('admin.cleanup', { count: totalOrphans }) }}
          </Button>
        </div>
      </div>
    </template>

  </div>
</template>
