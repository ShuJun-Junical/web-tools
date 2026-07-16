<script setup lang="ts">
import { computed, ref } from 'vue';
import { ImageUp } from '@lucide/vue';
import { useDropZone, useEventListener, useFileDialog } from '@vueuse/core';
import ToolPage from '@/components/ToolPage.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useClipboardActions } from '@/composables/useClipboardActions';
import { useToast } from '@/composables/useToast';
import { parseImageDataUrl } from '@/lib/codecs';

const dropZone = ref<HTMLElement | null>(null);
const dataUrl = ref('');
const fileName = ref('image');
const imageError = ref('');
const { copyPending, clipboardError, copyText, readText } =
  useClipboardActions();
const { showToast } = useToast();
const feedback = computed(() => imageError.value || clipboardError.value);
const preview = computed(() => parseImageDataUrl(dataUrl.value)?.dataUrl ?? '');
const displayedDataUrl = computed(() =>
  dataUrl.value.length > 240
    ? `${dataUrl.value.slice(0, 100)}\n\n…… 中间内容已省略 ……\n\n${dataUrl.value.slice(-100)}`
    : dataUrl.value,
);
const downloadName = computed(() => {
  const mimeType = parseImageDataUrl(dataUrl.value)?.mimeType;
  if (!mimeType || fileName.value.includes('.')) return fileName.value;
  const extension = mimeType
    .split('/')[1]
    .replace('jpeg', 'jpg')
    .replace('+xml', '');
  return `${fileName.value}.${extension}`;
});
const { open, onChange, reset } = useFileDialog({
  accept: 'image/*',
  multiple: false,
  reset: true,
});

onChange(files => {
  if (files?.[0]) readImage(files[0]);
});

const { isOverDropZone } = useDropZone(dropZone, {
  multiple: false,
  preventDefaultForUnhandled: true,
  checkValidity: items =>
    [...items].every(
      item => item.kind === 'file' && item.type.startsWith('image/'),
    ),
  onDrop(files) {
    if (files?.[0]) readImage(files[0]);
    else imageError.value = '请拖入一个有效的图片文件。';
  },
});

function readImage(file: File) {
  imageError.value = '';
  if (!file.type.startsWith('image/')) {
    imageError.value = '请选择图片文件。';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const value = String(reader.result ?? '');
    if (!parseImageDataUrl(value)) {
      imageError.value = '无法读取这个图片文件。';
      return;
    }
    dataUrl.value = value;
    fileName.value = file.name || 'image';
  };
  reader.onerror = () => {
    imageError.value = '读取图片失败。';
  };
  reader.readAsDataURL(file);
}

async function pasteDataUrl(event?: ClipboardEvent) {
  let value: string | null;

  if (event) {
    const image = [...(event.clipboardData?.files ?? [])].find(file =>
      file.type.startsWith('image/'),
    );
    if (image) {
      readImage(image);
      return;
    }
    value = event.clipboardData?.getData('text') ?? '';
  } else if (navigator.clipboard?.read) {
    clipboardError.value = '';
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const image = await item.getType(imageType);
          readImage(new File([image], 'image', { type: imageType }));
          return;
        }
      }

      const textItem = items.find(item => item.types.includes('text/plain'));
      value = textItem
        ? await (await textItem.getType('text/plain')).text()
        : '';
    } catch {
      clipboardError.value = '读取剪贴板失败，请检查浏览器权限。';
      return;
    }
  } else {
    value = await readText();
  }
  if (value === null) return;

  const parsed = parseImageDataUrl(value);
  if (!parsed) {
    showToast('剪贴板内容不是有效的图片 Data URL');
    return;
  }

  dataUrl.value = parsed.dataUrl;
  imageError.value = '';
}

useEventListener('paste', event => {
  event.preventDefault();
  pasteDataUrl(event);
});

function clear() {
  dataUrl.value = '';
  fileName.value = 'image';
  imageError.value = '';
  reset();
}
</script>

<template>
  <ToolPage
    title="Base64 图片"
    category="编解码工具"
    description="将图片转换为 Data URL，或粘贴 Data URL 预览并下载图片。"
  >
    <div class="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>选择与预览</CardTitle></CardHeader>
        <CardContent class="space-y-4">
          <div
            ref="dropZone"
            :role="preview ? undefined : 'button'"
            :tabindex="preview ? undefined : 0"
            class="flex min-h-72 flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed p-6 text-center transition-colors"
            :class="[
              isOverDropZone ? 'border-primary bg-accent' : 'border-border',
              !preview && 'cursor-pointer hover:bg-accent/50',
            ]"
            :aria-label="
              preview ? '图片预览，可拖入图片替换' : '选择或拖入图片'
            "
            @click="preview ? undefined : open()"
            @keydown.enter.prevent="!preview && open()"
            @keydown.space.prevent="!preview && open()"
          >
            <img
              v-if="preview"
              :src="preview"
              alt="Data URL 图片预览"
              class="max-h-96 max-w-full object-contain"
            />
            <template v-else>
              <ImageUp
                class="mb-3 size-8 text-muted-foreground"
                aria-hidden="true"
              />
              <p class="font-medium">点击选择图片，或将图片拖到这里</p>
              <p class="mt-1 text-sm text-muted-foreground">
                图片只在当前浏览器中读取
              </p>
            </template>
          </div>
          <div v-if="preview" class="flex flex-wrap gap-2">
            <Button as-child>
              <a :href="preview" :download="downloadName">下载图片</a>
            </Button>
            <Button variant="outline" @click="clear">清除图片</Button>
            <Button variant="outline" @click="open()">替换图片</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Data URL</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <Textarea
            :model-value="displayedDataUrl"
            class="min-h-72 resize-y font-mono text-xs"
            placeholder="data:image/png;base64,..."
            readonly
            :aria-invalid="Boolean(imageError)"
          />
          <div class="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              :disabled="!preview || copyPending"
              @click="copyText(dataUrl)"
              >复制</Button
            >
            <Button variant="outline" @click="pasteDataUrl()">粘贴</Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <p
      v-if="feedback"
      role="status"
      aria-live="polite"
      :class="
        imageError || clipboardError
          ? 'text-destructive'
          : 'text-muted-foreground'
      "
      class="text-sm"
    >
      {{ feedback }}
    </p>
  </ToolPage>
</template>
