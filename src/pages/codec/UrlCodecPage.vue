<script setup lang="ts">
import { ref } from 'vue'
import ToolPage from '@/components/ToolPage.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useClipboardActions } from '@/composables/useClipboardActions'
import { useToast } from '@/composables/useToast'
import { decodeUrl, encodeUrl, looksLikeUrlEncoding } from '@/lib/codecs'

const original = ref('')
const encoded = ref('')
const conversionError = ref('')
const { copyPending, clipboardError, copyText, readText } = useClipboardActions()
const { showToast } = useToast()

function updateOriginal(value: string | number) {
  original.value = String(value)
  encoded.value = encodeUrl(original.value)
  conversionError.value = ''
}

function updateEncoded(value: string | number) {
  encoded.value = String(value)
  try {
    original.value = decodeUrl(encoded.value)
    conversionError.value = ''
  } catch {
    conversionError.value = '这不是有效的 URL 编码字符串。'
  }
}

async function pasteOriginal() {
  const value = await readText()
  if (value === null) return
  updateOriginal(value)
}

async function pasteEncoded() {
  const value = await readText()
  if (value === null) return
  acceptPastedEncoded(value)
}

function acceptPastedEncoded(value: string) {
  if (!looksLikeUrlEncoding(value)) {
    updateOriginal(value)
    return 'original'
  }

  updateEncoded(value)
  if (!conversionError.value) return 'encoded'

  showToast('这不是有效的 URL 编码字符串')
  return 'invalid'
}

async function pasteAndCopy() {
  const value = await readText()
  if (value === null) return

  const detected = acceptPastedEncoded(value)
  if (detected === 'invalid') return

  await copyText(
    detected === 'encoded' ? original.value : encoded.value,
    detected === 'encoded'
      ? '检测到有效的 URL 编码，已复制原文。'
      : '检测到文本，已转为 URL 编码。',
  )
}

function handleEncodedPaste(event: ClipboardEvent) {
  if (!event.clipboardData) return
  event.preventDefault()
  acceptPastedEncoded(event.clipboardData.getData('text'))
}

function clear() {
  original.value = ''
  encoded.value = ''
  conversionError.value = ''
}
</script>

<template>
  <ToolPage title="URL 编解码" category="编解码工具" description="使用 encodeURIComponent 规则转换 URL 组件。">
    <div class="flex flex-wrap gap-2">
      <Button variant="secondary" @click="pasteAndCopy">粘贴并自动检测</Button>
      <Button variant="outline" :disabled="!original && !encoded" @click="clear">清空所有</Button>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>原文</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <Textarea :model-value="original" class="min-h-64 resize-y font-mono" placeholder="输入或粘贴原文" @update:model-value="updateOriginal" />
          <div class="flex gap-2">
            <Button variant="secondary" :disabled="!original || copyPending" @click="copyText(original)">复制</Button>
            <Button variant="outline" @click="pasteOriginal()">粘贴</Button>
            <Button variant="outline" :disabled="!original" @click="updateOriginal('')">清空</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>URL 编码</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <Textarea
            :model-value="encoded"
            class="min-h-64 resize-y font-mono"
            placeholder="输入或粘贴 URL 编码"
            :aria-invalid="Boolean(conversionError)"
            @paste="handleEncodedPaste"
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

    <p v-if="clipboardError" role="status" aria-live="polite" class="text-sm text-destructive">
      {{ clipboardError }}
    </p>
  </ToolPage>
</template>
