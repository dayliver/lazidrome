<script setup>
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Share2, Link2, FileText } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { copyText, formatShareMarkdown, getPageShareUrl } from '@/lib/shareLink'

const props = defineProps({
  /** 마크다운 링크 텍스트. 없으면 마크다운 항목 비활성화 */
  markdownLabel: {
    type: String,
    default: '',
  },
})

const { t } = useI18n()

const copyUrl = async () => {
  try {
    await copyText(getPageShareUrl())
    toast.success(t('share.copiedUrl'))
  } catch {
    toast.error(t('share.failed'))
  }
}

const copyMarkdown = async () => {
  const label = props.markdownLabel?.trim()
  if (!label) return
  try {
    await copyText(formatShareMarkdown(label))
    toast.success(t('share.copiedMarkdown'))
  } catch {
    toast.error(t('share.failed'))
  }
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon"
        class="rounded-full shrink-0"
        :aria-label="t('share.button')"
      >
        <Share2 class="w-5 h-5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-52">
      <DropdownMenuLabel class="text-xs text-muted-foreground font-medium">
        {{ t('share.menuTitle') }}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem class="gap-2 cursor-pointer" @click="copyUrl">
        <Link2 class="w-4 h-4 shrink-0 opacity-70" />
        {{ t('share.copyUrl') }}
      </DropdownMenuItem>
      <DropdownMenuItem
        class="gap-2 cursor-pointer"
        :disabled="!markdownLabel?.trim()"
        @click="copyMarkdown"
      >
        <FileText class="w-4 h-4 shrink-0 opacity-70" />
        {{ t('share.copyMarkdown') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
