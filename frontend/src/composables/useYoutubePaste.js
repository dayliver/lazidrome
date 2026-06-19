import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { isYoutubeUrl, classifyYoutubeUrl } from '@/lib/youtubeUrl';

function isEditableTarget(el) {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest('[contenteditable="true"]'));
}

export function useYoutubePaste() {
  const router = useRouter();
  const auth = useAuthStore();
  const { t } = useI18n();

  const handlePaste = (e) => {
    if (!auth.isAuthenticated) return;
    if (isEditableTarget(e.target)) return;

    const text = e.clipboardData?.getData('text/plain')?.trim();
    if (!text || !isYoutubeUrl(text)) return;

    e.preventDefault();

    const kind = classifyYoutubeUrl(text);
    const msg =
      kind === 'playlist'
        ? t('download.pasteConfirmPlaylist')
        : t('download.pasteConfirmVideo');

    if (!confirm(msg)) return;

    void router.push({ name: 'import', query: { url: text } });
  };

  onMounted(() => {
    window.addEventListener('paste', handlePaste);
  });

  onUnmounted(() => {
    window.removeEventListener('paste', handlePaste);
  });
}
