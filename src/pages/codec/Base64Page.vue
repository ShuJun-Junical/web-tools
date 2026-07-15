<script setup lang="ts">
import { computed, ref } from 'vue'
import ToolPage from '@/components/ToolPage.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useClipboardActions } from '@/composables/useClipboardActions'
import { decodeBase64, encodeBase64 } from '@/lib/codecs'

const original = ref('')
const encoded = ref('')
const conversionError = ref('')
const { copied, copyPending, clipboardError, copyText, readText } = useClipboardActions()
const feedback = computed(() => conversionError.value || clipboardError.value || (copied.value ? '已复制到剪贴板。' : ''))

function updateOriginal(value: string | number) {
  original.value = String(value)
  encoded.value = encodeBase64(original.value)
  conversionError.value = ''
}

function updateEncoded(value: string | number) {
  encoded.value = String(value)
  try {
    const decoded = decodeBase64(encoded.value)
    original.value = decoded
    conversionError.value = ''
  } catch {
    conversionError.value = '这不是有效的 UTF-8 Base64 字符串。'
  }
}

async function pasteOriginal(copyAfter = false) {
  const value = await readText()
  if (value === null) return
  updateOriginal(value)
  if (copyAfter) await copyText(encoded.value)
}

async function pasteEncoded(copyAfter = false) {
  const value = await readText()
  if (value === null) return
  updateEncoded(value)
  if (copyAfter && !conversionError.value) await copyText(original.value)
}

function clear() {
  original.value = ''
  encoded.value = ''
  conversionError.value = ''
}
</script>

<template>
  <ToolPage title="Base64 文本" category="编解码工具" description="在 UTF-8 文本与 Base64 之间实时转换，数据只在浏览器中处理。">
    <div class="flex flex-wrap gap-2">
      <Button variant="secondary" @click="pasteOriginal(true)">粘贴原文并复制编码</Button>
      <Button variant="secondary" @click="pasteEncoded(true)">粘贴编码并复制原文</Button>
      <Button variant="outline" :disabled="!original && !encoded" @click="clear">清空所有</Button>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>原文（UTF-8）</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <Textarea
            id="base64-original"
            :model-value="original"
            class="min-h-64 resize-y font-mono"
            placeholder="输入或粘贴原文"
            @update:model-value="updateOriginal"
          />
          <div class="flex gap-2">
            <Button variant="secondary" :disabled="!original || copyPending" @click="copyText(original)">复制</Button>
            <Button variant="outline" @click="pasteOriginal()">粘贴</Button>
            <Button variant="outline" :disabled="!original" @click="updateOriginal('')">清空</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Base64</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <Textarea
            id="base64-encoded"
            :model-value="encoded"
            class="min-h-64 resize-y font-mono"
            placeholder="输入或粘贴 Base64"
            :aria-invalid="Boolean(conversionError)"
            @update:model-value="updateEncoded"
          />
          <div class="flex gap-2">
            <Button variant="secondary" :disabled="!encoded || copyPending" @click="copyText(encoded)">复制</Button>
            <Button variant="outline" @click="pasteEncoded()">粘贴</Button>
            <Button variant="outline" :disabled="!encoded" @click="updateEncoded('')">清空</Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <p v-if="feedback" role="status" aria-live="polite" :class="conversionError || clipboardError ? 'text-destructive' : 'text-muted-foreground'" class="text-sm">
      {{ feedback }}
    </p>
  </ToolPage>
</template>
