<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue';
import { useExifHistory } from '@/composables/useExifHistory';
import { ChevronDown, ImageUp, RotateCcw, RotateCw } from '@lucide/vue';
import { useDropZone, useEventListener, useFileDialog } from '@vueuse/core';
import {
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionRoot,
  AccordionTrigger,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui';
import ToolPage from '@/components/ToolPage.vue';
import ExifFieldRow from '@/components/ExifFieldRow.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  bytesToHex,
  hexByteCount,
  hexValidationError,
  isSupportedImageFile,
  newBlockValidationError,
  supportedImageExtensions,
} from '@/lib/image-container';
import {
  dataTypesForGroup,
  fieldValidationError,
  isExifStyleGroup,
  tagGroups,
} from '@/lib/exif-custom';
import { commonFieldNames } from '@/lib/exif-presets';
import type { ExifAction, ExifField, ExifOperation, ExifResult } from '@/lib/exif-types';

const accept = supportedImageExtensions.join(',');
const largeBlockBytes = 32768;
const groupItems = tagGroups.map((value) => ({ value, label: value }));
const dropZone = ref<HTMLElement | null>(null);
const original = shallowRef<File | null>(null);
const historyApi = useExifHistory();
const previewUrl = ref('');
const originalUrl = ref('');
const showOriginal = ref(false);
const previewFailed = ref(false);
const busy = ref(false);
const stage = ref('');
const percent = ref<number | null>(null);
const error = ref('');
const query = ref('');
const groupFilter = ref('all');
const openGroups = ref<string[]>([]);
const editKey = ref('');

/** 编辑已有原始附加块的表单（块 id + 十六进制内容 + 是否大块提示） */
const rawForm = reactive({
  blockId: '',
  hex: '',
  large: false,
});

/** 新增原始附加块的表单（块类型 + 十六进制内容） */
const newBlockForm = reactive({
  kind: '',
  hex: '',
});

/** 新增自定义字段的表单 */
const addForm = reactive({
  group: 'IFD0',
  xmpPrefix: '',
  tag: '',
  type: 'string',
  value: '',
  namespaceUri: '',
  touched: false,
});
const confirmOpen = ref(false);
const confirmKind = ref<'replace'>('replace');
const pendingFile = shallowRef<File | null>(null);
let worker: Worker | null = null;
let requestId = 0;
let activeController: AbortController | null = null;

const { open, onChange, reset } = useFileDialog({ accept, multiple: false, reset: true });
onChange((files) => {
  if (files?.[0]) offerFile(files[0]);
});

const { isOverDropZone } = useDropZone(dropZone, {
  multiple: false,
  preventDefaultForUnhandled: true,
  onDrop(files) {
    if (files?.[0]) offerFile(files[0]);
    else error.value = '请拖入 JPEG、PNG 或 WebP 图片。';
  },
});

useEventListener('paste', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
    return;
  const file = [...(event.clipboardData?.files ?? [])].find((item) =>
    item.type.startsWith('image/')
  );
  if (file) {
    event.preventDefault();
    offerFile(new File([file], file.name || 'pasted.png', { type: file.type }));
  }
});

const modified = computed(() => historyApi.canUndo.value);
const displayUrl = computed(() => (showOriginal.value ? originalUrl.value : previewUrl.value));
const downloadName = computed(() => {
  const name = original.value?.name ?? 'image.png';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)}-edited${name.slice(dot)}` : `${name}-edited`;
});
const filteredFields = computed(() =>
  (historyApi.current.value?.fields ?? []).filter((field) => {
    if (groupFilter.value !== 'all' && field.group !== groupFilter.value) return false;
    const search = query.value.trim().toLowerCase();
    return !search || `${field.key} ${field.value}`.toLowerCase().includes(search);
  })
);
const commonFields = computed(() =>
  filteredFields.value.filter((field) => commonFieldNames.has(field.name))
);
const otherGroups = computed(() => {
  const groups = new Map<string, ExifField[]>();
  for (const field of filteredFields.value) {
    if (commonFieldNames.has(field.name)) continue;
    const list = groups.get(field.group) ?? [];
    list.push(field);
    groups.set(field.group, list);
  }
  return [...groups].map(([name, fields]) => ({ name, fields }));
});
const allGroups = computed(() => [
  ...new Set((historyApi.current.value?.fields ?? []).map((field) => field.group)),
]);
const filterItems = computed(() => [
  { value: 'all', label: '全部来源' },
  ...allGroups.value.map((value) => ({ value, label: value })),
]);
const gpsPresent = computed(() =>
  (historyApi.current.value?.fields ?? []).some(
    (field) => field.group === 'GPS' || /GPSLatitude|GPSLongitude|LocationShown/i.test(field.name)
  )
);
const unknownBlocks = computed(() => (historyApi.current.value?.blocks ?? []).filter((block) => !block.known));
const originalSigned = computed(() => historyApi.initialEntry.value?.signed ?? false);

const effectiveGroup = computed(() =>
  addForm.group === 'XMP' ? `XMP-${addForm.xmpPrefix.trim()}` : addForm.group
);
const dataTypeOptions = computed(() => dataTypesForGroup(effectiveGroup.value));
const dataTypeItems = computed(() =>
  dataTypeOptions.value.map((value) => ({ value, label: value }))
);
const identifierPlaceholder = computed(() =>
  isExifStyleGroup(addForm.group) ? '字段标识：内置英文名或 0x 编号' : '字段标识，例如 Note'
);
const newFieldError = computed(() =>
  fieldValidationError(effectiveGroup.value, addForm.tag, addForm.type, addForm.namespaceUri)
);
const newFieldVisibleError = computed(() =>
  (addForm.touched || addForm.value || addForm.tag) && newFieldError.value
    ? newFieldError.value
    : ''
);
const rawHexError = computed(() => hexValidationError(rawForm.hex));
const rawBlockHexInfo = computed(
  () =>
    `当前 ${hexByteCount(rawForm.hex)} 字节${rawForm.large ? '；该块较大，建议优先使用字段级写入' : ''}`
);
const newBlockErrorText = computed(() => {
  if (!historyApi.current.value || (!newBlockForm.kind.trim() && !newBlockForm.hex.trim())) return '';
  return newBlockValidationError(historyApi.current.value.format, newBlockForm.kind, newBlockForm.hex);
});

watch(() => addForm.type, (value) => {
  if (!dataTypeOptions.value.includes(value)) addForm.type = 'string';
});

watch(historyApi.current, (value) => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = value ? URL.createObjectURL(value.file) : '';
  previewFailed.value = false;
});
watch(original, (value) => {
  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value);
  originalUrl.value = value ? URL.createObjectURL(value) : '';
});
onBeforeUnmount(() => {
  worker?.terminate();
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value);
});

function getWorker() {
  worker ??= new Worker(new URL('../../lib/exif-worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

function run(action: ExifAction): Promise<ExifResult> {
  busy.value = true;
  error.value = '';
  stage.value = '准备处理';
  percent.value = null;
  const id = ++requestId;
  const controller = new AbortController();
  activeController = controller;
  const target = getWorker();
  return new Promise<ExifResult>((resolve, reject) => {
    const cleanup = () => {
      target.onmessage = null;
      target.onerror = null;
      if (activeController === controller) activeController = null;
    };
    const finish = (callback: () => void) => {
      busy.value = false;
      cleanup();
      callback();
    };
    target.onmessage = (event) => {
      if (controller.signal.aborted) return;
      const message = event.data as {
        id: number;
        type: string;
        stage?: string;
        percent?: number;
        result?: ExifResult;
        message?: string;
      };
      if (message.id !== id) return;
      if (message.type === 'progress') {
        stage.value = message.stage ?? '';
        percent.value = message.percent ?? null;
        return;
      }
      if (message.type === 'result' && message.result) {
        const result = message.result;
        finish(() => resolve(result));
      } else finish(() => reject(new Error(message.message ?? '处理图片失败。')));
    };
    target.onerror = () => {
      if (controller.signal.aborted) return;
      finish(() => reject(new Error('本地图片处理引擎异常：启动失败或运行出错，请重试。')));
    };
    controller.signal.addEventListener('abort', () => {
      const reason = controller.signal.reason as { silent?: boolean } | undefined;
      finish(() =>
        reject(Object.assign(new Error('操作已取消。'), { cancelled: true, silent: !!reason?.silent }))
      );
    });
    target.postMessage({ id, action });
  });
}

function cancel(silent = false) {
  activeController?.abort(silent ? { silent: true } : undefined);
  worker?.terminate();
  worker = null;
  busy.value = false;
  stage.value = '';
  percent.value = null;
}

function reportFailure(cause: unknown) {
  const err = cause as Error & { cancelled?: boolean; silent?: boolean };
  if (err.cancelled && err.silent) return;
  error.value = err.message;
}

function offerFile(file: File) {
  if (!isSupportedImageFile(file)) {
    error.value = '仅支持 JPEG、PNG 和 WebP 文件；HEIC、AVIF 暂未开放。';
    return;
  }
  if (historyApi.dirty.value) {
    pendingFile.value = file;
    confirmKind.value = 'replace';
    confirmOpen.value = true;
  } else void loadFile(file);
}

function clearForms() {
  editKey.value = '';
  Object.assign(rawForm, { blockId: '', hex: '', large: false });
  Object.assign(newBlockForm, { kind: '', hex: '' });
  Object.assign(addForm, {
    group: 'IFD0',
    xmpPrefix: '',
    tag: '',
    type: 'string',
    value: '',
    namespaceUri: '',
    touched: false,
  });
}

async function loadFile(file: File) {
  if (busy.value) cancel(true);
  try {
    const result = await run({ type: 'inspect', file, original: file });
    original.value = file;
    historyApi.init(result);
    openGroups.value = [];
    query.value = '';
    groupFilter.value = 'all';
    showOriginal.value = false;
    clearForms();
    reset();
  } catch (cause) {
    reportFailure(cause);
  }
}

async function apply(action: ExifOperation) {
  if (!historyApi.current.value || !original.value || busy.value) return;
  try {
    const result = await run({ ...action, file: historyApi.current.value.file, original: original.value });
    historyApi.push(result);
    editKey.value = '';
    rawForm.blockId = '';
    if (
      groupFilter.value !== 'all' &&
      !result.fields.some((field) => field.group === groupFilter.value)
    )
      groupFilter.value = 'all';
  } catch (cause) {
    reportFailure(cause);
  }
}

function undo() {
  historyApi.undo();
}
function redo() {
  historyApi.redo();
}
function resetToOriginal() {
  historyApi.resetToInitial();
  clearForms();
}
function confirmChoice() {
  if (confirmKind.value === 'replace' && pendingFile.value) void loadFile(pendingFile.value);
  pendingFile.value = null;
  confirmOpen.value = false;
}
function startEdit(field: ExifField) {
  editKey.value = field.key;
}
function applyEdit(field: ExifField, value: string) {
  void apply({ type: 'write', tag: field.key, value });
}
function removeField(field: ExifField) {
  void apply({ type: 'write', tag: field.key });
}
function addField() {
  addForm.touched = true;
  if (newFieldError.value) return;
  void apply({
    type: 'add',
    group: effectiveGroup.value,
    identifier: addForm.tag.trim(),
    dataType: addForm.type.trim(),
    value: addForm.value,
    namespaceUri: addForm.namespaceUri.trim() || undefined,
  });
}
async function startRaw(id: string) {
  if (!historyApi.current.value) return;
  const block = historyApi.current.value.blocks.find((item) => item.id === id);
  if (!block) return;
  const bytes = new Uint8Array(await historyApi.current.value.file.arrayBuffer());
  rawForm.blockId = id;
  rawForm.large = block.dataEnd - block.dataStart > largeBlockBytes;
  rawForm.hex = bytesToHex(bytes.subarray(block.dataStart, block.dataEnd));
}
function toggleAll() {
  openGroups.value =
    openGroups.value.length === otherGroups.value.length
      ? []
      : otherGroups.value.map((group) => group.name);
}
function download() {
  if (!historyApi.current.value || busy.value) return;
  const link = document.createElement('a');
  link.href = previewUrl.value;
  link.download = downloadName.value;
  link.click();
}
</script>

<template>
  <ToolPage>
    <div class="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>选择与预览</CardTitle>
          <CardDescription>图片仅在当前浏览器中处理，不上传或保存。</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <div
            ref="dropZone"
            class="flex min-h-72 items-center justify-center overflow-hidden rounded-xl border border-dashed p-4"
            :class="isOverDropZone ? 'border-primary bg-accent' : 'border-border'"
          >
            <div v-if="!historyApi.current.value" class="flex flex-col items-center gap-2 text-center">
              <ImageUp class="size-8 text-muted-foreground" aria-hidden="true" />
              <p>选择、拖入或粘贴一张 JPEG、PNG、WebP 图片</p>
              <Button :disabled="busy" @click="open()">选择图片</Button>
            </div>
            <img
              v-else-if="displayUrl && !previewFailed"
              :src="displayUrl"
              :alt="showOriginal ? '原始图片' : '待保存图片'"
              class="max-h-[28rem] max-w-full object-contain"
              @error="previewFailed = true"
            />
            <p v-else role="status" class="text-sm text-destructive">
              当前图片无法预览；原始块编辑可能已破坏文件结构。
            </p>
          </div>
          <div v-if="historyApi.current.value" class="flex flex-wrap items-center gap-2">
            <Button variant="outline" :disabled="busy" @click="open()">替换图片</Button>
            <Button variant="outline" :disabled="busy" @click="showOriginal = !showOriginal">{{
              showOriginal ? '查看待保存版本' : '查看原图'
            }}</Button>
            <Button
              variant="outline"
              :disabled="busy || !historyApi.canUndo"
              aria-label="撤销"
              @click="undo"
              ><RotateCcw />撤销</Button
            >
            <Button
              variant="outline"
              :disabled="busy || !historyApi.canRedo"
              aria-label="重做"
              @click="redo"
              ><RotateCw />重做</Button
            >
            <Button variant="outline" :disabled="busy || !historyApi.dirty" @click="resetToOriginal"
              >恢复原文件</Button
            >
            <Button :disabled="busy" @click="download">下载待保存文件</Button>
          </div>
        </CardContent>
      </Card>

      <div v-if="historyApi.current.value || busy || error" class="flex min-h-14 flex-col justify-center gap-2">
        <div
          v-if="busy"
          role="status"
          aria-live="polite"
          class="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3 text-sm"
        >
          <span>{{ stage }}{{ percent === null ? '' : ` ${percent}%` }}</span>
          <Button variant="outline" size="sm" @click="cancel()">取消操作</Button>
        </div>
        <p v-else-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
      </div>

      <template v-if="historyApi.current.value">
        <Card>
          <CardHeader><CardTitle>当前待保存状态</CardTitle></CardHeader>
          <CardContent class="grid gap-2 text-sm sm:grid-cols-2">
            <p>格式：{{ historyApi.current.value?.format.toUpperCase() }}{{ historyApi.current.value?.animated ? ' · 动画' : '' }}</p>
            <p>GPS：{{ gpsPresent ? '存在' : '未发现' }}</p>
            <p>字段：{{ historyApi.current.value?.fields.length }} 项；未知附加块：{{ unknownBlocks.length }} 个</p>
            <p>
              图像数据：{{
                historyApi.current.value?.imageUnchanged === true
                  ? '与原文件一致'
                  : historyApi.current.value?.imageUnchanged === false
                    ? '已改变'
                    : '无法确认'
              }}
            </p>
            <p v-if="originalSigned" class="sm:col-span-2">
              原文件包含 C2PA 等签名来源信息；{{
                modified ? '当前修改可能使签名失效或已将其移除。' : '修改文件后签名可能失效。'
              }}
            </p>
            <p v-if="historyApi.current.value?.unsupportedMultiImage" class="sm:col-span-2 text-destructive">
              此多图 JPEG 变体仅支持查看，暂不支持编辑导出。
            </p>
            <p v-if="historyApi.current.value?.warning" role="alert" class="sm:col-span-2 text-destructive">
              {{ historyApi.current.value?.warning }}
            </p>
            <p v-if="unknownBlocks.length" class="sm:col-span-2 text-muted-foreground">
              未知附加块将在普通清理中保留；强力清理会移除。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>清理元数据</CardTitle></CardHeader>
          <CardContent class="flex flex-col gap-3">
            <div class="flex flex-wrap gap-2">
              <Button
                :disabled="busy || historyApi.current.value?.unsupportedMultiImage"
                @click="apply({ type: 'clear', mode: 'normal' })"
                >普通清理</Button
              >
              <Button
                variant="destructive"
                :disabled="busy || historyApi.current.value?.unsupportedMultiImage"
                @click="apply({ type: 'clear', mode: 'strong' })"
                >强力清理</Button
              >
            </div>
            <p class="text-sm text-muted-foreground">普通清理保留方向、色彩配置与未知附加块。</p>
            <p class="text-sm text-destructive">
              强力清理会删除方向、ICC
              等显示相关信息，图片可能旋转或偏色；只有通过结构与图像数据校验才会生成结果。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            ><CardTitle>常用信息</CardTitle
            ><CardDescription
              >这里汇总了含义明确的常见元数据，可点圈问号查看说明；如需修改字段值，请前往下方“全部元数据”。</CardDescription
            ></CardHeader
          >
          <CardContent>
            <p v-if="!commonFields.length" class="text-sm text-muted-foreground">
              未发现常用的元数据字段。
            </p>
            <ExifFieldRow
              v-for="field in commonFields"
              :key="field.key"
              :field="field"
              :busy="busy"
              :locked="historyApi.current.value?.unsupportedMultiImage"
              @remove="removeField(field)"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            ><CardTitle>全部元数据</CardTitle
            ><CardDescription
              >按字段名、值和来源筛选；同义字段按各自来源独立显示。</CardDescription
            ></CardHeader
          >
          <CardContent class="flex flex-col gap-4">
            <div class="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
              <Input v-model="query" aria-label="搜索元数据" placeholder="搜索字段名或值" />
              <Select v-model="groupFilter" :items="filterItems" label="筛选元数据来源" />
              <Button variant="outline" @click="toggleAll">{{
                openGroups.length === otherGroups.length ? '全部收起' : '展开非空类别'
              }}</Button>
            </div>
            <AccordionRoot v-model="openGroups" type="multiple" class="rounded-lg border">
              <AccordionItem
                v-for="group in otherGroups"
                :key="group.name"
                :value="group.name"
                class="border-b last:border-b-0"
              >
                <AccordionHeader>
                  <AccordionTrigger
                    class="flex w-full items-center justify-between p-3 text-left font-medium hover:bg-accent/50"
                  >
                    {{ group.name }}（{{ group.fields.length }}）<ChevronDown
                      class="size-4"
                      aria-hidden="true"
                    />
                  </AccordionTrigger>
                </AccordionHeader>
                <AccordionContent class="px-3 pb-3">
                  <ExifFieldRow
                    v-for="field in group.fields"
                    :key="field.key"
                    :field="field"
                    :busy="busy"
                    :locked="historyApi.current.value?.unsupportedMultiImage"
                    :editable="true"
                    :editing="editKey === field.key"
                    @edit="startEdit(field)"
                    @apply="(value) => applyEdit(field, value)"
                    @remove="removeField(field)"
                    @cancel="editKey = ''"
                  />
                </AccordionContent>
              </AccordionItem>
            </AccordionRoot>
            <p v-if="!otherGroups.length" class="text-sm text-muted-foreground">
              没有其他匹配的元数据字段。
            </p>

            <div class="flex flex-col gap-2 border-t pt-4">
              <h3 class="font-medium">新增字段</h3>
              <p class="text-sm text-muted-foreground">
                层级与类型从受支持集合中选择；无法字段级写入的私有结构可使用下方原始块编辑。
              </p>
              <div class="grid gap-2 sm:grid-cols-3">
                <Select v-model="addForm.group" :items="groupItems" label="字段层级" />
                <Input
                  v-if="addForm.group === 'XMP'"
                  v-model="addForm.xmpPrefix"
                  aria-label="XMP 命名空间前缀"
                  placeholder="前缀，例如 dc"
                />
                <Input
                  v-model="addForm.tag"
                  aria-label="字段标识"
                  :placeholder="identifierPlaceholder"
                  @input="addForm.touched = true"
                />
                <Select v-model="addForm.type" :items="dataTypeItems" label="字段类型" />
              </div>
              <Input
                v-model="addForm.value"
                aria-label="字段值"
                placeholder="字段值"
                @input="addForm.touched = true"
              />
              <Input
                v-if="addForm.group === 'XMP'"
                v-model="addForm.namespaceUri"
                aria-label="自定义 XMP 命名空间 URI"
                placeholder="自定义 XMP 命名空间 URI（现有命名空间可留空）"
              />
              <p
                class="min-h-5 text-xs text-destructive"
                :role="newFieldVisibleError ? 'alert' : undefined"
              >
                {{ newFieldVisibleError }}
              </p>
              <Button
                class="self-start"
                :disabled="busy || historyApi.current.value?.unsupportedMultiImage"
                @click="addField"
                >新增字段</Button
              >
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            ><CardTitle>原始附加块</CardTitle
            ><CardDescription
              >十六进制编辑可改变块长度；请自行确认内部字段结构。损坏结果会带强警告，仍可下载。</CardDescription
            ></CardHeader
          >
          <CardContent class="flex flex-col gap-3">
            <div v-for="block in historyApi.current.value?.blocks" :key="block.id" class="rounded-lg border p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm">
                  <strong>{{ block.label }}</strong> · {{ block.dataEnd - block.dataStart }} 字节{{
                    block.known ? '' : ' · 未知'
                  }}
                </p>
                <Button
                  v-if="block.kind !== 'Trailer'"
                  variant="outline"
                  size="sm"
                  :disabled="busy || historyApi.current.value?.unsupportedMultiImage"
                  @click="startRaw(block.id)"
                  >编辑原始块</Button
                >
              </div>
              <div v-if="rawForm.blockId === block.id" class="mt-3 flex flex-col gap-2">
                <Textarea
                  v-model="rawForm.hex"
                  :aria-label="`编辑 ${block.label} 十六进制字节`"
                  class="min-h-40 font-mono text-xs"
                />
                <p
                  class="min-h-5 text-xs"
                  :class="rawHexError ? 'text-destructive' : 'text-muted-foreground'"
                  :role="rawHexError ? 'alert' : undefined"
                >
                  {{ rawHexError || rawBlockHexInfo }}
                </p>
                <div class="flex gap-2">
                  <Button
                    size="sm"
                    :disabled="busy"
                    @click="apply({ type: 'raw', blockId: block.id, hex: rawForm.hex })"
                    >应用原始编辑</Button
                  >
                  <Button size="sm" variant="ghost" @click="rawForm.blockId = ''">取消</Button>
                </div>
              </div>
            </div>
            <div class="flex flex-col gap-2 border-t pt-4">
              <h3 class="font-medium">新增原始附加块</h3>
              <p class="text-sm text-muted-foreground">
                JPEG 使用 APP0–APP15 或 COM；PNG 使用四字母辅助块名；WebP 使用四字母块名。
              </p>
              <Input
                v-model="newBlockForm.kind"
                aria-label="新块类型"
                placeholder="块类型，例如 APP1、iTXt、XMP"
              />
              <Textarea
                v-model="newBlockForm.hex"
                aria-label="新块十六进制字节"
                class="min-h-28 font-mono text-xs"
                placeholder="十六进制原始字节"
              />
              <p
                class="min-h-5 text-xs"
                :class="newBlockErrorText ? 'text-destructive' : 'text-muted-foreground'"
                :role="newBlockErrorText ? 'alert' : undefined"
              >
                {{
                  newBlockErrorText ||
                  (newBlockForm.hex.trim() ? `当前 ${hexByteCount(newBlockForm.hex)} 字节` : '')
                }}
              </p>
              <Button
                class="self-start"
                :disabled="busy || historyApi.current.value?.unsupportedMultiImage"
                @click="apply({ type: 'addBlock', kind: newBlockForm.kind, hex: newBlockForm.hex })"
                >新增原始块</Button
              >
            </div>
          </CardContent>
        </Card>
      </template>
    </div>

    <AlertDialogRoot v-model:open="confirmOpen">
      <AlertDialogPortal>
        <AlertDialogOverlay class="fixed inset-0 z-50 bg-foreground/50" />
        <AlertDialogContent
          class="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg"
        >
          <AlertDialogTitle class="text-lg font-semibold">替换当前图片？</AlertDialogTitle>
          <AlertDialogDescription class="mt-2 text-sm text-muted-foreground"
            >当前修改及撤销历史将丢失。</AlertDialogDescription
          >
          <div class="mt-5 flex justify-end gap-2">
            <AlertDialogCancel as-child
              ><Button variant="outline" @click="pendingFile = null"
                >取消</Button
              ></AlertDialogCancel
            >
            <AlertDialogAction as-child
              ><Button @click="confirmChoice">继续</Button></AlertDialogAction
            >
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>
  </ToolPage>
</template>
