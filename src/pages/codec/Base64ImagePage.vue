<script setup lang="ts">
import { computed, ref } from 'vue'
import { ImageUp } from '@lucide/vue'
import { useDropZone, useFileDialog } from '@vueuse/core'
import ToolPage from '@/components/ToolPage.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useClipboardActions } from '@/composables/useClipboardActions'
import { parseImageDataUrl } from '@/lib/codecs'

const dropZone = ref<HTMLElement | null>(null)
const dataUrl = ref('')
const fileName = ref('image')
const imageError = ref('')
const { copied, copyPending, clipboardError, copyText, readText } = useClipboardActions()
const feedback = computed(() => imageError.value || clipboardError.value || (copied.value ? '已复制到剪贴板。' : ''))
const preview = computed(() => parseImageDataUrl(dataUrl.value)?.dataUrl ?? '')
const downloadName = computed(() => {
  const mimeType = parseImageDataUrl(dataUrl.value)?.mimeType
  if (!mimeType || fileName.value.includes('.')) return fileName.value
  const extension = mimeType.split('/')[1].replace('jpeg', 'jpg').replace('+xml', '')
  return `${fileName.value}.${extension}`
})
const { open, onChange, reset } = useFileDialog({ accept: 'image/*', multiple: false, reset: true })

onChange(files => {
  if (files?.[0]) readImage(files[0])
})

const { isOverDropZone } = useDropZone(dropZone, {
  multiple: false,
  preventDefaultForUnhandled: true,
  checkValidity: items => [...items].every(item => item.kind === 'file' && item.type.startsWith('image/')),
  onDrop(files) {
    if (files?.[0]) readImage(files[0])
    else imageError.value = '请拖入一个有效的图片文件。'
  },
})

function readImage(file: File) {
  imageError.value = ''
  if (!file.type.startsWith('image/')) {
    imageError.value = '请选择图片文件。'
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    const value = String(reader.result ?? '')
    if (!parseImageDataUrl(value)) {
      imageError.value = '无法读取这个图片文件。'
      return
    }
    dataUrl.value = value
    fileName.value = file.name
  }
  reader.onerror = () => { imageError.value = '读取图片失败。' }
  reader.readAsDataURL(file)
}

function updateDataUrl(value: string | number) {
  dataUrl.value = String(value)
  imageError.value = dataUrl.value && !parseImageDataUrl(dataUrl.value) ? '这不是有效的图片 Data URL。' : ''
}

async function pasteDataUrl() {
  const value = await readText()
  if (value !== null) updateDataUrl(value)
}

function clear() {
  dataUrl.value = ''
  fileName.value = 'image'
  imageError.value = ''
  reset()
}
</script>

<template>
  <ToolPage title="Base64 图片" category="编解码工具" description="将图片转换为 Data URL，或粘贴 Data URL 预览并下载图片。">
    <Card>
      <CardHeader><CardTitle>选择图片</CardTitle></CardHeader>
      <CardContent class="space-y-4">
        <div
          ref="dropZone"
          role="button"
          tabindex="0"
          class="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors"
          :class="isOverDropZone ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'"
          aria-label="选择或拖入图片"
          @click="open()"
          @keydown.enter.prevent="open()"
          @keydown.space.prevent="open()"
        >
          <ImageUp class="mb-3 size-8 text-muted-foreground" aria-hidden="true" />
          <p class="font-medium">点击选择图片，或将图片拖到这里</p>
          <p class="mt-1 text-sm text-muted-foreground">图片只在当前浏览器中读取</p>
        </div>
      </CardContent>
    </Card>

    <div class="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Data URL</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <Textarea
            :model-value="dataUrl"
            class="min-h-72 resize-y font-mono text-xs"
            placeholder="data:image/png;base64,..."
            :aria-invalid="Boolean(imageError)"
            @update:model-value="updateDataUrl"
          />
          <div class="flex flex-wrap gap-2">
            <Button variant="secondary" :disabled="!preview || copyPending" @click="copyText(dataUrl)">复制</Button>
            <Button variant="outline" @click="pasteDataUrl">粘贴</Button>
            <Button variant="outline" :disabled="!dataUrl" @click="clear">清空</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>图片预览</CardTitle></CardHeader>
        <CardContent class="space-y-4">
          <div class="flex min-h-72 items-center justify-center overflow-hidden rounded-lg bg-muted/60 p-4">
            <img v-if="preview" :src="preview" alt="Data URL 图片预览" class="max-h-96 max-w-full object-contain" />
            <p v-else class="text-sm text-muted-foreground">选择图片或粘贴有效的 Data URL 后显示预览。</p>
          </div>
          <Button v-if="preview" as-child>
            <a :href="preview" :download="downloadName">下载图片</a>
          </Button>
          <Button v-else disabled>下载图片</Button>
        </CardContent>
      </Card>
    </div>

    <p v-if="feedback" role="status" aria-live="polite" :class="imageError || clipboardError ? 'text-destructive' : 'text-muted-foreground'" class="text-sm">
      {{ feedback }}
    </p>
  </ToolPage>
</template>
