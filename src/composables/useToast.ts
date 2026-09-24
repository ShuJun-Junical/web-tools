import { ref } from 'vue';

interface ToastItem {
  id: number;
  message: string;
  variant: 'success' | 'error';
  timer: ReturnType<typeof setTimeout> | null;
}

const DEFAULT_DURATION = 3000;
const toasts = ref<ToastItem[]>([]);

export function useToast() {
  function showToast(value: string, type: 'success' | 'error' = 'error') {
    const existing = toasts.value.find((t) => t.message === value && t.variant === type);
    if (existing) {
      existing.id = Date.now();
      resetTimer(existing);
      return;
    }

    const toast: ToastItem = {
      id: Date.now(),
      message: value,
      variant: type,
      timer: null,
    };
    toasts.value.push(toast);
    resetTimer(toast);
  }

  function resetTimer(toast: ToastItem) {
    if (toast.timer) clearTimeout(toast.timer);
    toast.timer = setTimeout(() => removeToast(toast), DEFAULT_DURATION);
  }

  function removeToast(toast: ToastItem) {
    const index = toasts.value.indexOf(toast);
    if (index === -1) return;
    if (toast.timer) clearTimeout(toast.timer);
    toasts.value.splice(index, 1);
  }

  return { toasts, showToast };
}
