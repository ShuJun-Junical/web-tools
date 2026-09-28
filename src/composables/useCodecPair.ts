import { ref, watch, type Ref } from 'vue';
import { useClipboardActions } from '@/composables/useClipboardActions';
import { useToast } from '@/composables/useToast';

export interface CodecPairOptions {
  /** 原文 → 编码文本 */
  encode: (value: string) => string;
  /** 编码文本 → 原文（无效输入抛错，由 useCodecPair 兜住） */
  decode: (value: string) => string;
  /** 形如该 codec 编码文本的快速判别，用于粘贴自动检测 */
  looksLike: (value: string) => boolean;
  /** 解码失败时的行内 + Toast 文案 */
  errorMessage: string;
  /** 粘贴后复制回执：检测到编码时复制原文，检测到原文时复制编码 */
  copyLabels: { fromEncoded: string; fromOriginal: string };
}

/**
 * 文本 ↔ 编码双向同步 + 粘贴自动检测。Base64 / URL / Punycode 三个工具共用同一份契约。
 * 切换 optionsRef 时清空原文 / 编码 / 错误，避免上一个 codec 的残留干扰新 codec 的展示。
 */
export function useCodecPair(optionsRef: Ref<CodecPairOptions>) {
  const original = ref('');
  const encoded = ref('');
  const conversionError = ref('');
  const { copyPending, clipboardError, copyText, readText } = useClipboardActions();
  const { showToast } = useToast();

  watch(optionsRef, () => {
    original.value = '';
    encoded.value = '';
    conversionError.value = '';
  });

  function updateOriginal(value: string | number) {
    original.value = String(value);
    encoded.value = optionsRef.value.encode(original.value);
    conversionError.value = '';
  }

  function updateEncoded(value: string | number) {
    encoded.value = String(value);
    try {
      original.value = optionsRef.value.decode(encoded.value);
      conversionError.value = '';
    } catch {
      conversionError.value = optionsRef.value.errorMessage;
    }
  }

  async function pasteOriginal() {
    const value = await readText();
    if (value === null) return;
    updateOriginal(value);
  }

  async function pasteEncoded() {
    const value = await readText();
    if (value === null) return;
    acceptPastedEncoded(value);
  }

  /**
   * 粘贴后自动检测：先尝试按编码解析；解析成功 → 当作编码；解析失败但不像
   * 编码格式 → 当原文写入；解析失败且像编码格式 → 报错。
   */
  function acceptPastedEncoded(value: string): 'encoded' | 'original' | 'invalid' {
    updateEncoded(value);
    if (!conversionError.value) return 'encoded';

    if (!optionsRef.value.looksLike(value)) {
      updateOriginal(value);
      return 'original';
    }

    showToast(optionsRef.value.errorMessage);
    return 'invalid';
  }

  async function pasteAndCopy() {
    const value = await readText();
    if (value === null) return;

    const detected = acceptPastedEncoded(value);
    if (detected === 'invalid') return;

    await copyText(
      detected === 'encoded' ? original.value : encoded.value,
      detected === 'encoded' ? optionsRef.value.copyLabels.fromEncoded : optionsRef.value.copyLabels.fromOriginal
    );
  }

  function handleEncodedPaste(event: ClipboardEvent) {
    if (!event.clipboardData) return;
    event.preventDefault();
    acceptPastedEncoded(event.clipboardData.getData('text'));
  }

  function clear() {
    original.value = '';
    encoded.value = '';
    conversionError.value = '';
  }

  return {
    original,
    encoded,
    conversionError,
    copyPending,
    clipboardError,
    copyText,
    updateOriginal,
    updateEncoded,
    pasteOriginal,
    pasteEncoded,
    pasteAndCopy,
    handleEncodedPaste,
    clear,
  };
}
