import { toast } from 'vue-sonner'

export const notify = {
  success: (message, opts) => toast.success(message, opts),
  info: (message, opts) => toast.info(message, opts),
  warning: (message, opts) => toast.warning(message, opts),
  error: (message, opts) => toast.error(message, opts),
}
