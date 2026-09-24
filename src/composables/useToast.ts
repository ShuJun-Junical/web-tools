import { reactive, ref } from 'vue';

type ToastVariant = 'success' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  open: boolean;
}

const DEFAULT_DURATION = 3000;
const toasts = ref<ToastItem[]>([]);
const timers = new Map<number, ReturnType<typeof setTimeout>>();
/** 被重复触发、等旧弹窗淡出完成后用同样内容重新入队的弹窗，按旧弹窗 id 记录 */
const pendingRepeats = new Map<number, { message: string; variant: ToastVariant }>();
let nextId = 0;

export function useToast() {
  function showToast(value: string, type: ToastVariant = 'error') {
    const existing = toasts.value.find((t) => t.message === value && t.variant === type);
    if (existing) {
      // 同内容再次触发：旧弹窗在原位淡出，淡出结束（after-leave → handleToastLeft）后重新入队一条一样的
      pendingRepeats.set(existing.id, { message: value, variant: type });
      closeToast(existing);
      return;
    }

    enqueue(value, type);
  }

  function enqueue(message: string, variant: ToastVariant) {
    const toast = reactive<ToastItem>({
      id: (nextId += 1),
      message,
      variant,
      open: true,
    });
    toasts.value.unshift(toast);
    timers.set(
      toast.id,
      setTimeout(() => closeToast(toast), DEFAULT_DURATION)
    );
  }

  function closeToast(toast: ToastItem) {
    if (!toast.open) return;
    toast.open = false;
    stopTimer(toast);
  }

  function stopTimer(toast: ToastItem) {
    const timer = timers.get(toast.id);
    if (timer === undefined) return;
    clearTimeout(timer);
    timers.delete(toast.id);
  }

  /** 宿主在弹窗离场（after-leave）时调用：出队，并在它被重复触发过时补一条一样的重新入场 */
  function handleToastLeft(toast: ToastItem) {
    const index = toasts.value.findIndex((t) => t === toast);
    if (index === -1) return;
    toasts.value.splice(index, 1);
    stopTimer(toast);

    const pending = pendingRepeats.get(toast.id);
    if (!pending) return;
    pendingRepeats.delete(toast.id);
    enqueue(pending.message, pending.variant);
  }

  return { toasts, showToast, closeToast, handleToastLeft };
}

export function __resetToastsForTests() {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  toasts.value.splice(0);
  pendingRepeats.clear();
}
