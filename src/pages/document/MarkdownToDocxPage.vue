<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { Archive, FileDown, FolderOpen, Loader2, RotateCcw } from '@lucide/vue';
import { useDropZone, useFileDialog } from '@vueuse/core';
import ToolPage from '@/components/ToolPage.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup } from '@/components/ui/radio-group';
import type {
  DocxFolderEntry,
  DocxWorkerJob,
  DocxWorkerRequest,
  DocxWorkerResponse,
  DocxWorkerSuccess,
} from '@/lib/docx-worker';
import type { PagePreset } from '@/lib/docx-build';

const pageItems = [
  { value: 'a4', label: 'A4 标准' },
  { value: 'a4-narrow', label: 'A4 窄边距' },
  { value: 'letter', label: 'Letter' },
];

const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * 递归读取拖放进来的目录条目。
 *
 * dataTransfer.files 遇到文件夹只会给一个读不出字节的空壳 File，唯一的办法是用
 * webkitGetAsEntry 拿到目录树自己走。相对路径按 input.webkitdirectory 的口径拼：
 * 顶层目录名放在最前，两种来源才能共用同一套解析逻辑。
 */
async function readEntryTree(
  entry: FileSystemEntry,
  prefix: string,
  out: DocxFolderEntry[]
): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File | null>((resolve) =>
      (entry as FileSystemFileEntry).file(resolve, () => resolve(null))
    );
    if (file) out.push({ path: `${prefix}${entry.name}`, file });
    return;
  }

  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // readEntries 一次最多吐 100 条，必须一直读到空批次才算读完。
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve) =>
      reader.readEntries(resolve, () => resolve([]))
    );
    if (batch.length === 0) return;
    for (const child of batch) await readEntryTree(child, `${prefix}${entry.name}/`, out);
  }
}

const dropZone = ref<HTMLElement | null>(null);
const page = ref('a4');
const archive = ref<File | null>(null);
// shallowRef：这份数组是直接 postMessage 发给 worker 的载荷，不能被包成 reactive Proxy，
// 否则结构化克隆会报 "could not be cloned"。这里只整体替换，不做原地修改。
const folderEntries = shallowRef<DocxFolderEntry[] | null>(null);
const busy = ref(false);
const stage = ref('');
const error = ref('');
const result = ref<DocxWorkerSuccess | null>(null);
const downloadUrl = ref('');
const downloadName = ref('document.docx');

let worker: Worker | null = null;
let requestId = 0;
let folderInput: HTMLInputElement | null = null;
let activeController: AbortController | null = null;

const {
  open: openZip,
  onChange: onZipChange,
  reset: resetZip,
} = useFileDialog({
  accept: '.zip,application/zip',
  multiple: false,
  reset: true,
});

onZipChange((files) => {
  const file = files?.[0];
  if (file) {
    archive.value = file;
    folderEntries.value = null;
    void convert();
  }
});

const sourceLabel = computed(() => {
  if (archive.value) return archive.value.name;
  return (folderEntries.value?.[0]?.path ?? '').split('/')[0] || '';
});

const issueText = computed(() => {
  const issues = result.value?.issues ?? [];
  if (issues.length === 0) return '';
  return `${issues.length} 张图片没能写入文档：\n${issues
    .map((issue) => `· ${issue.ref} —— ${issue.reason}`)
    .join('\n')}`;
});

function getWorker() {
  worker ??= new Worker(new URL('../../lib/docx-worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

function run(job: DocxWorkerJob): Promise<DocxWorkerSuccess> {
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;

  busy.value = true;
  error.value = '';
  stage.value = '准备转换';
  const id = (requestId += 1);
  const target = getWorker();

  return new Promise<DocxWorkerSuccess>((resolve, reject) => {
    const cleanup = () => {
      target.onmessage = null;
      target.onerror = null;
      if (activeController === controller) activeController = null;
    };
    target.onmessage = (event: MessageEvent<DocxWorkerResponse>) => {
      if (controller.signal.aborted) return;
      const message = event.data;
      if (message.id !== id) return;
      if (message.type === 'progress') {
        stage.value = message.stage;
        return;
      }
      busy.value = false;
      cleanup();
      if (message.type === 'result') resolve(message.result);
      else reject(new Error(message.message));
    };
    target.onerror = () => {
      if (controller.signal.aborted) return;
      busy.value = false;
      cleanup();
      reject(new Error('转换引擎启动失败，请刷新页面后重试。'));
    };
    target.postMessage({ id, ...job } satisfies DocxWorkerRequest);
  });
}

function releaseDownload() {
  if (!downloadUrl.value) return;
  URL.revokeObjectURL(downloadUrl.value);
  downloadUrl.value = '';
}

async function convert() {
  // pageItems 的取值就是 PagePreset 的全部成员，这里只做类型收窄。
  const preset = page.value as PagePreset;
  const job: DocxWorkerJob | null = archive.value
    ? { type: 'zip', page: preset, archive: archive.value }
    : folderEntries.value
      ? { type: 'folder', page: preset, files: folderEntries.value }
      : null;
  if (!job) return;

  try {
    const value = await run(job);
    releaseDownload();
    downloadUrl.value = URL.createObjectURL(new Blob([value.bytes], { type: docxMime }));
    downloadName.value = `${value.title.replace(/[\\/:*?"<>|]/g, '_') || 'document'}.docx`;
    result.value = value;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '转换失败。';
    // postMessage 同步抛错（比如载荷不可结构化克隆）时走不到 onmessage，
    // 这里不放开 busy 的话界面会一直停在「转换中」。
    busy.value = false;
    releaseDownload();
    result.value = null;
  }
}

function pickFolder() {
  folderInput?.click();
}

function onFolderChange(event: Event) {
  const files = [...((event.target as HTMLInputElement).files ?? [])];
  if (files.length > 0) {
    // 结构化克隆不会携带 webkitRelativePath，路径必须在这里取出来一起交给 worker。
    folderEntries.value = files.map((file) => ({
      path: file.webkitRelativePath || file.name,
      file,
    }));
    archive.value = null;
    void convert();
  }
  if (folderInput) folderInput.value = '';
}

function clearSource() {
  archive.value = null;
  folderEntries.value = null;
  result.value = null;
  error.value = '';
  releaseDownload();
  resetZip();
}

/** 拖进来的条目：目录走文件夹来源，文件按 zip 处理。 */
async function onDropEntries(_files: File[] | null, event: DragEvent) {
  const items = [...(event.dataTransfer?.items ?? [])];
  const entries = items
    .map((item) => (item.kind === 'file' ? item.webkitGetAsEntry?.() : null))
    .filter((entry): entry is FileSystemEntry => entry !== null);

  if (entries.some((entry) => entry.isDirectory)) {
    const collected: DocxFolderEntry[] = [];
    for (const entry of entries) await readEntryTree(entry, '', collected);
    if (collected.length === 0) {
      error.value = '没有从这个文件夹里读到文件，请重新拖一次。';
      return;
    }
    folderEntries.value = collected;
    archive.value = null;
    void convert();
    return;
  }

  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  archive.value = file;
  folderEntries.value = null;
  void convert();
}

// preventDefaultForUnhandled 让无效拖放也吃掉默认行为，
// 否则多选文件拖到页面上浏览器会当成跳转，把当前页面导航走。
const { isOverDropZone } = useDropZone(dropZone, {
  multiple: false,
  preventDefaultForUnhandled: true,
  onDrop: onDropEntries,
});

watch(page, () => {
  if (archive.value || folderEntries.value) void convert();
});

// 选择目录依赖原生 input 的 webkitdirectory，没有等价的 shadcn 组件，只能隐藏一个原生控件。
onMounted(() => {
  folderInput = document.createElement('input');
  folderInput.type = 'file';
  folderInput.multiple = true;
  folderInput.webkitdirectory = true;
  folderInput.className = 'hidden';
  folderInput.addEventListener('change', onFolderChange);
  document.body.appendChild(folderInput);
});

onBeforeUnmount(() => {
  activeController?.abort();
  worker?.terminate();
  releaseDownload();
  folderInput?.remove();
});
</script>

<template>
  <ToolPage>
    <div class="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>文档来源</CardTitle>
          <CardDescription>
            选择包含 Markdown 与图片的 zip
            压缩包，或直接选择存放它们的本地文件夹。图片可以放在子目录里。
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div
            ref="dropZone"
            role="button"
            tabindex="0"
            aria-label="选择或拖入 zip 压缩包或文件夹"
            class="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
            :class="isOverDropZone ? 'border-primary bg-accent' : 'border-border'"
            @click="openZip()"
            @keydown.enter.prevent="openZip()"
            @keydown.space.prevent="openZip()"
          >
            <Archive class="mb-3 size-8 text-muted-foreground" aria-hidden="true" />
            <p class="font-medium">点击选择 zip，或把 zip / 文件夹拖到这里</p>
            <p class="mt-1 text-sm text-muted-foreground">文件只在当前浏览器中读取</p>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button variant="outline" @click="openZip()">
              <Archive class="size-4" aria-hidden="true" />
              选择 zip
            </Button>
            <Button variant="outline" @click="pickFolder">
              <FolderOpen class="size-4" aria-hidden="true" />
              选择文件夹
            </Button>
            <Button v-if="sourceLabel" variant="ghost" @click="clearSource">清除</Button>
          </div>

          <p v-if="sourceLabel" class="text-sm text-muted-foreground">
            已选择：{{ sourceLabel }}<template v-if="result"> · 主文档 {{ result.entry }}</template>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>输出设置</CardTitle>
          <CardDescription>转换全部在本地完成，不会上传任何文件。</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <RadioGroup v-model="page" :items="pageItems" label="页面设置" />

          <div class="flex flex-wrap items-center gap-2">
            <Button :disabled="busy || !sourceLabel" @click="convert">
              <Loader2 v-if="busy" class="size-4 animate-spin" aria-hidden="true" />
              <RotateCcw v-else class="size-4" aria-hidden="true" />
              {{ busy ? '转换中' : '重新转换' }}
            </Button>
            <Button v-if="downloadUrl" as-child variant="secondary">
              <a :href="downloadUrl" :download="downloadName">
                <FileDown class="size-4" aria-hidden="true" />
                下载 Word
              </a>
            </Button>
          </div>

          <p v-if="busy" role="status" aria-live="polite" class="text-sm text-muted-foreground">
            {{ stage }}
          </p>

          <p v-else-if="result" role="status" class="text-sm text-muted-foreground">
            已生成 {{ downloadName }}，内嵌 {{ result.imageCount }} 张图片。
          </p>

          <p v-if="result && result.matchedByFileName > 0" class="text-sm text-muted-foreground">
            其中 {{ result.matchedByFileName }} 张图片是按文件名匹配到的，改成完整相对路径会更稳妥。
          </p>

          <p v-if="issueText" role="alert" class="whitespace-pre-line text-sm text-destructive">
            {{ issueText }}
          </p>

          <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        </CardContent>
      </Card>
    </div>
  </ToolPage>
</template>
