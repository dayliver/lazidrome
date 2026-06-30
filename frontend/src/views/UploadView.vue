<script setup>
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import LocalFileImportPanel from '@/components/import/LocalFileImportPanel.vue'

const { t } = useI18n()
const { showAuthEmpty } = useRequiresAuth()
</script>

<template>
  <PageLayout>
    <ViewHeader
      :title="t('upload.title')"
      :description="t('upload.subtitle')"
      :show-action="false"
    />

    <AuthEmptyState v-if="showAuthEmpty" :description="t('upload.authRequired')" />

    <template v-else>
      <LocalFileImportPanel />

      <p class="text-xs text-muted-foreground text-center">
        {{ t('upload.youtubeHint') }}
        <RouterLink to="/import" class="text-primary underline-offset-4 hover:underline">
          {{ t('upload.youtubeLink') }}
        </RouterLink>
      </p>
    </template>
  </PageLayout>
</template>
