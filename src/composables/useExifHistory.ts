import { computed, ref, shallowRef } from 'vue';
import type { ExifResult } from '@/lib/exif-types';

/**
 * 撤销/重做栈：current 是栈内当前项的视图，其它写入只能通过 init / push / undo / redo / resetToInitial。
 * 这保证 historyIndex 与 stack 的不变量（index 永远在 [0, stack.length) 内）在 composable 内部维护。
 * 组件首次挂载时尚无初始结果，可用 init(initial) 在加载文件后再启用。
 */
export function useExifHistory() {
  const stack = shallowRef<ExifResult[]>([]);
  const index = ref(-1);

  const current = computed(() => (index.value >= 0 ? stack.value[index.value] : null));
  const canUndo = computed(() => index.value > 0);
  const canRedo = computed(() => index.value < stack.value.length - 1);
  const dirty = computed(() => stack.value.length > 1);
  const initialEntry = computed(() => stack.value[0] ?? null);

  function init(initial: ExifResult) {
    stack.value = [initial];
    index.value = 0;
  }

  function push(result: ExifResult) {
    stack.value = [...stack.value.slice(0, index.value + 1), result];
    index.value++;
  }

  function undo() {
    if (canUndo.value) index.value--;
  }

  function redo() {
    if (canRedo.value) index.value++;
  }

  function resetToInitial() {
    if (!stack.value.length) return;
    stack.value = [stack.value[0]];
    index.value = 0;
  }

  return {
    current,
    canUndo,
    canRedo,
    dirty,
    initialEntry,
    init,
    push,
    undo,
    redo,
    resetToInitial,
  };
}
