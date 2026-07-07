<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Hash } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
})

const emit = defineEmits(['update:isOpen'])

const { t } = useI18n()
const router = useRouter()
const name = ref('')

watch(
  () => props.isOpen,
  (open) => {
    if (open) name.value = ''
  },
)

function invalidLabel(value) {
  const s = String(value || '').trim()
  if (!s) return t('tagEdit.noName')
  if (s.includes('..') || /[/\\]/.test(s)) return t('tagEdit.invalidChars')
  if (s.length > 200) return t('tagEdit.maxLength')
  return ''
}

function close() {
  emit('update:isOpen', false)
}

function submit() {
  const trimmed = name.value.trim()
  const err = invalidLabel(trimmed)
  if (err) {
    toast.error(err)
    return
  }
  close()
  toast.success(t('pages.tags.createReady'))
  void router.push({ name: 'tag-detail', params: { name: trimmed } })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      @click.self="close"
    >
      <div
        class="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div class="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 class="flex items-center gap-2 text-lg font-bold">
              <Hash class="h-5 w-5 text-primary" />
              {{ t('pages.tags.createTitle') }}
            </h2>
            <p class="mt-1 text-sm text-muted-foreground">{{ t('pages.tags.createHint') }}</p>
          </div>
          <Button variant="ghost" size="icon" class="shrink-0" @click="close">
            <X class="h-5 w-5" />
          </Button>
        </div>

        <div class="space-y-2">
          <Label for="tag-create-name">{{ t('tagEdit.name') }}</Label>
          <Input
            id="tag-create-name"
            v-model="name"
            class="border-2"
            :placeholder="t('pages.tags.createPlaceholder')"
            @keyup.enter="submit"
          />
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <Button variant="outline" @click="close">{{ t('common.cancel') }}</Button>
          <Button @click="submit">{{ t('pages.tags.createSubmit') }}</Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
