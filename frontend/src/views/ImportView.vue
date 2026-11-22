<script setup>
import { watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import { useYoutubeImportForm } from '@/composables/useYoutubeImportForm'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import ImportTrackTable from '@/components/import/ImportTrackTable.vue'
import ImportProgress from '@/components/import/ImportProgress.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { showAuthEmpty } = useRequiresAuth()

const {
  importStore,
  urlInput,
  rows,
  playlistTitle,
  sourceUrl,
  ytPhase,
  canSubmitYoutube,
  resolveFromUrl,
  startYoutubeImport,
  resetYoutube,
} = useYoutubeImportForm()

async function loadFromQuery() {
  const q = String(route.query.url || '').trim()
  if (q) {
    urlInput.value = q
    await resolveFromUrl(q)
  }
}

onMounted(() => {
  importStore.reset()
  void loadFromQuery()
})

onUnmounted(() => {
  importStore.reset()
})

watch(
  () => route.query.url,
  (u) => {
    if (u && String(u) !== sourceUrl.value) {
      urlInput.value = String(u)
      void resolveFromUrl(String(u))
    }
  },
)

async function handleResolveManual() {
  const u = urlInput.value.trim()
  if (!u) return
  await router.replace({ name: 'import', query: { url: u } })
  await resolveFromUrl(u)
}
</script>

<template>
  <PageLayout>
    <ViewHeader
      :title="t('import.title')"
      :description="t('import.subtitle')"
      :show-action="false"
    />

    <AuthEmptyState v-if="showAuthEmpty" :description="t('import.authRequired')" />

    <template v-else>
      <div class="space-y-3 rounded-xl border p-4">
        <Label for="yt-url">{{ t('import.urlLabel') }}</Label>
        <div class="flex flex-col gap-2 lg:flex-row">
          <Input
            id="yt-url"
            v-model="urlInput"
            :placeholder="t('import.urlPlaceholder')"
            class="font-mono text-base sm:text-sm"
            @keyup.enter="handleResolveManual"
          />
          <Button
            type="button"
            variant="secondary"
            :disabled="importStore.resolving"
            @click="handleResolveManual"
          >
            {{ importStore.resolving ? t('import.resolving') : t('import.resolve') }}
          </Button>
        </div>
        <p class="text-xs text-muted-foreground">{{ t('import.pasteHint') }}</p>
      </div>

      <div v-if="importStore.resolving" class="py-12 text-center text-muted-foreground text-sm">
        {{ t('import.resolving') }}
      </div>

      <template v-else-if="rows.length">
        <ImportTrackTable
          v-if="ytPhase === 'form'"
          v-model:rows="rows"
          :playlist-title="playlistTitle"
        />

        <ImportProgress
          v-if="ytPhase === 'running' || ytPhase === 'done'"
          :status="importStore.jobStatus"
        />

        <div v-if="ytPhase === 'form'" class="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" :disabled="!canSubmitYoutube" @click="startYoutubeImport">
            {{ t('import.start', { count: rows.filter((r) => r.selected).length }) }}
          </Button>
        </div>

        <div v-if="ytPhase === 'done'" class="flex gap-2">
          <Button type="button" variant="outline" as-child>
            <RouterLink to="/tracks">{{ t('import.goTracks') }}</RouterLink>
          </Button>
          <Button type="button" variant="secondary" @click="resetYoutube">
            {{ t('import.importAnother') }}
          </Button>
        </div>
      </template>

      <p v-else class="text-xs text-muted-foreground text-center">
        {{ t('import.uploadHint') }}
        <RouterLink to="/upload" class="text-primary underline-offset-4 hover:underline">
          {{ t('import.uploadLink') }}
        </RouterLink>
      </p>
    </template>
  </PageLayout>
</template>
