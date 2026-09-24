<script setup lang="ts">
import { ref } from 'vue';
import ToolPage from '@/components/ToolPage.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useClipboardActions } from '@/composables/useClipboardActions';
import { useToast } from '@/composables/useToast';
import { decodeBase64, encodeBase64, looksLikeBase64 } from '@/lib/codecs';

const original = ref('');
const encoded = ref('');
const conversionError = ref('');
const { copyPending, clipboardError, copyText, readText } = useClipboardActions();
const { showToast } = useToast();

function updateOriginal(value: string | number) {
  original.value = String(value);
  encoded.value = encodeBase64(original.value);
  conversionError.value = '';
}

function updateEncoded(value: string | number) {
  encoded.value = String(value);
  try {
    const decoded = decodeBase64(encoded.value);
    original.value = decoded;
    conversionError.value = '';
  } catch {
    conversionError.value = '这不是有效的 UTF-8 Base64 字符串。';
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

function acceptPastedEncoded(value: string) {
  updateEncoded(value);
  if (!conversionError.value) return 'base64';

  if (!looksLikeBase64(value)) {
    updateOriginal(value);
    return 'original';
  }

  showToast('这不是有效的 UTF-8 Base64 字符串');
  return 'invalid';
}

async function pasteAndCopy() {
  const value = await readText();
  if (value === null) return;

  const detected = acceptPastedEncoded(value);
  if (detected === 'invalid') return;

  await copyText(
    detected === 'base64' ? original.value : encoded.value,
    detected === 'base64' ? '检测到有效的 Base64，已复制原文。' : '检测到文本，已转为 Base64。'
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
</script>

<template>
  <ToolPage>
    <div class="flex flex-wrap gap-2">
      <Button variant="secondary" @click="pasteAndCopy">粘贴并自动检测</Button>
      <Button variant="outline" :disabled="!original && !encoded" @click="clear">清空所有</Button>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>原文（UTF-8）</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <Textarea
            id="base64-original"
            :model-value="original"
            class="min-h-64 resize-y"
            monospace
            placeholder="输入或粘贴原文"
            @update:model-value="updateOriginal"
          />
          <div class="flex gap-2">
            <Button
              variant="secondary"
              :disabled="!original || copyPending"
              @click="copyText(original)"
              >复制</Button
            >
            <Button variant="outline" @click="pasteOriginal()">粘贴</Button>
            <Button variant="outline" :disabled="!original" @click="updateOriginal('')"
              >清空</Button
            >
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Base64</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <Textarea
            id="base64-encoded"
            :model-value="encoded"
            class="min-h-64 resize-y"
            monospace
            placeholder="输入或粘贴 Base64"
            :aria-invalid="Boolean(conversionError)"
            @paste="handleEncodedPaste"
            @update:model-value="updateEncoded"
          />
          <div class="flex gap-2">
            <Button
              variant="secondary"
              :disabled="!encoded || copyPending"
              @click="copyText(encoded)"
              >复制</Button
            >
            <Button variant="outline" @click="pasteEncoded()">粘贴</Button>
            <Button variant="outline" :disabled="!encoded" @click="updateEncoded('')">清空</Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <p v-if="clipboardError" role="status" aria-live="polite" class="text-sm text-destructive">
      {{ clipboardError }}
    </p>
  </ToolPage>
</template>
