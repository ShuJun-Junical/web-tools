import { computed, ref } from 'vue';
import { parseNumberLines } from '@/lib/statistics';

/**
 * 共享统计输入状态：textarea 文本 + parseNumberLines 派生 + 行内错误信息 + 清空。
 * 三页统计工具（Data / Correlation / Independence 子部分）共用同一份契约。
 */
export function useNumberLinesInput(initial = '') {
  const text = ref(initial);
  const parsed = computed(() => parseNumberLines(text.value));
  const hasError = computed(() => parsed.value.invalidLines.length > 0);
  const errorMessage = computed(() => {
    const lines = parsed.value.invalidLines;
    return lines.length ? `第 ${lines.join('、')} 行不是有效数字，请修正后再计算。` : '';
  });

  function clear() {
    text.value = '';
  }

  return { text, parsed, hasError, errorMessage, clear };
}
