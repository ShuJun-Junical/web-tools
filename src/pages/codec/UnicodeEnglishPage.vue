<script setup lang="ts">
import { computed, ref } from 'vue'
import ToolPage from '@/components/ToolPage.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useClipboardActions } from '@/composables/useClipboardActions'
import {
  convertUnicodeStyle,
  listUnicodeStyles,
  normalizeUnicodeStyle,
} from '@/lib/unicode-english-converter'

const input = ref('Professional 2026')
const styles = listUnicodeStyles()
const normalized = computed(() => normalizeUnicodeStyle(input.value))
const results = computed(() =>
  styles.map(style => ({
    ...style,
    value: convertUnicodeStyle(normalized.value, style.id, {
      fullwidthSpace: style.id === 'fullwidth',
    }),
  })),
)
const { copyPending, clipboardError, copyText, readText } = useClipboardActions()

async function paste() {
  const value = await readText()
  if (value !== null) input.value = value
}
</script>

<template>
  <ToolPage>
    <Card>
      <CardHeader><CardTitle>输入文本</CardTitle></CardHeader>
      <CardContent class="space-y-3">
        <label for="unicode-english-input" class="sr-only">要转换的英文文本</label>
        <Textarea
          id="unicode-english-input"
          v-model="input"
          class="min-h-32 resize-y"
          monospace
          placeholder="输入英文、数字或已转换的 Unicode 文本"
        />
        <div class="flex gap-2">
          <Button variant="secondary" @click="paste">粘贴</Button>
          <Button variant="outline" :disabled="!input" @click="input = ''">清空</Button>
        </div>
      </CardContent>
    </Card>

    <div class="grid gap-4 sm:grid-cols-2">
      <Card v-for="result in results" :key="result.id">
        <CardHeader class="grid-cols-[minmax(0,1fr)_auto] grid-rows-1 items-center gap-3">
          <div>
            <CardTitle>{{ result.name }}</CardTitle>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ result.supportsDigits ? '支持数字样式' : '数字保持原样' }}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            :disabled="!result.value || copyPending"
            :aria-label="`复制${result.name}结果`"
            @click="copyText(result.value, `已复制${result.name}结果。`)"
          >
            复制
          </Button>
        </CardHeader>
        <CardContent>
          <p class="min-h-12 whitespace-pre-wrap break-words text-lg" aria-live="polite">{{ result.value || '—' }}</p>
        </CardContent>
      </Card>
    </div>

    <p v-if="clipboardError" role="status" aria-live="polite" class="text-sm text-destructive">
      {{ clipboardError }}
    </p>
  </ToolPage>
</template>
