<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { ChevronDown, ImageUp, RotateCcw, RotateCw } from '@lucide/vue';
import { useDropZone, useEventListener, useFileDialog } from '@vueuse/core';
import {
  AccordionContent, AccordionHeader, AccordionItem, AccordionRoot, AccordionTrigger,
  AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogOverlay, AlertDialogPortal, AlertDialogRoot, AlertDialogTitle,
} from 'reka-ui';
import ToolPage from '@/components/ToolPage.vue';
import ExifCommonField from '@/components/ExifCommonField.vue';
import ExifFieldRow from '@/components/ExifFieldRow.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  bytesToHex, hexByteCount, hexValidationError, isSupportedImageFile,
  newBlockValidationError, supportedImageExtensions,
} from '@/lib/image-container';
import { dataTypesForGroup, fieldValidationError, isExifStyleGroup, tagGroups } from '@/lib/exif-custom';
import { commonFieldNames } from '@/lib/exif-presets';
import type { ExifAction, ExifField, ExifOperation, ExifResult } from '@/lib/exif-types';

const accept = supportedImageExtensions.join(',');
const largeBlockBytes = 32768;
const groupItems = tagGroups.map(value => ({ value, label: value }));
const dropZone = ref<HTMLElement | null>(null);
const original = shallowRef<File | null>(null);
const current = shallowRef<ExifResult | null>(null);
const history = shallowRef<ExifResult[]>([]);
const historyIndex = ref(-1);
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
const rawBlockId = ref('');
const rawHex = ref('');
const rawBlockLarge = ref(false);
const newBlockKind = ref('');
const newBlockHex = ref('');
const newGroup = ref<string>('IFD0');
const newXmpPrefix = ref('');
const newTag = ref('');
const newType = ref<string>('string');
const newValue = ref('');
const newNamespaceUri = ref('');
const addTouched = ref(false);
const confirmOpen = ref(false);
const confirmKind = ref<'replace' | 'reset'>('replace');
const pendingFile = shallowRef<File | null>(null);
let worker: Worker | null = null;
let requestId = 0;
let rejectPending: ((reason: Error) => void) | null = null;
let silentCancel = false;

const { open, onChange, reset } = useFileDialog({ accept, multiple: false, reset: true });
onChange(files => { if (files?.[0]) offerFile(files[0]); });

const { isOverDropZone } = useDropZone(dropZone, {
  multiple: false,
  preventDefaultForUnhandled: true,
  onDrop(files) {
    if (files?.[0]) offerFile(files[0]);
    else error.value = '请拖入 JPEG、PNG 或 WebP 图片。';
  },
});

useEventListener('paste', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  const file = [...(event.clipboardData?.files ?? [])].find(item => item.type.startsWith('image/'));
  if (file) { event.preventDefault(); offerFile(new File([file], file.name || 'pasted.png', { type: file.type })); }
});

const modified = computed(() => historyIndex.value > 0);
const dirty = computed(() => history.value.length > 1);
const displayUrl = computed(() => showOriginal.value ? originalUrl.value : previewUrl.value);
const downloadName = computed(() => {
  const name = original.value?.name ?? 'image.png';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)}-edited${name.slice(dot)}` : `${name}-edited`;
});
const filteredFields = computed(() => (current.value?.fields ?? []).filter(field => {
  if (groupFilter.value !== 'all' && field.group !== groupFilter.value) return false;
  const search = query.value.trim().toLowerCase();
  return !search || `${field.key} ${field.value}`.toLowerCase().includes(search);
}));
const commonFields = computed(() => filteredFields.value.filter(field => commonFieldNames.has(field.name)));
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
const allGroups = computed(() => [...new Set((current.value?.fields ?? []).map(field => field.group))]);
const filterItems = computed(() => [{ value: 'all', label: '全部来源' }, ...allGroups.value.map(value => ({ value, label: value }))]);
const gpsPresent = computed(() => (current.value?.fields ?? []).some(field =>
  field.group === 'GPS' || /GPSLatitude|GPSLongitude|LocationShown/i.test(field.name)));
const unknownBlocks = computed(() => (current.value?.blocks ?? []).filter(block => !block.known));
const originalSigned = computed(() => history.value[0]?.signed ?? false);

const effectiveGroup = computed(() => newGroup.value === 'XMP' ? `XMP-${newXmpPrefix.value.trim()}` : newGroup.value);
const dataTypeOptions = computed(() => dataTypesForGroup(effectiveGroup.value));
const dataTypeItems = computed(() => dataTypeOptions.value.map(value => ({ value, label: value })));
const identifierPlaceholder = computed(() => isExifStyleGroup(newGroup.value) ? '字段标识：内置英文名或 0x 编号' : '字段标识，例如 Note');
const newFieldError = computed(() => fieldValidationError(effectiveGroup.value, newTag.value, newType.value, newNamespaceUri.value));
const newFieldVisibleError = computed(() => (addTouched.value || newValue.value || newTag.value) && newFieldError.value ? newFieldError.value : '');
const rawHexError = computed(() => hexValidationError(rawHex.value));
const rawBlockHexInfo = computed(() => `当前 ${hexByteCount(rawHex.value)} 字节${rawBlockLarge.value ? '；该块较大，建议优先使用字段级写入' : ''}`);
const newBlockErrorText = computed(() => {
  if (!current.value || (!newBlockKind.value.trim() && !newBlockHex.value.trim())) return '';
  return newBlockValidationError(current.value.format, newBlockKind.value, newBlockHex.value);
});

watch(newType, () => {
  if (!dataTypeOptions.value.includes(newType.value)) newType.value = 'string';
});

watch(current, value => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = value ? URL.createObjectURL(value.file) : '';
  previewFailed.value = false;
});
watch(original, value => {
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
  return new Promise((resolve, reject) => {
    rejectPending = reject;
    const target = getWorker();
    target.onmessage = event => {
      const message = event.data as { id: number; type: string; stage?: string; percent?: number; result?: ExifResult; message?: string };
      if (message.id !== id) return;
      if (message.type === 'progress') {
        stage.value = message.stage ?? '';
        percent.value = message.percent ?? null;
        return;
      }
      busy.value = false;
      rejectPending = null;
      if (message.type === 'result' && message.result) resolve(message.result);
      else reject(new Error(message.message ?? '处理图片失败。'));
    };
    target.onerror = () => {
      busy.value = false;
      rejectPending = null;
      reject(new Error('本地图片处理引擎异常：启动失败或运行出错，请重试。'));
    };
    target.postMessage({ id, action });
  });
}

function cancel(silent = false) {
  silentCancel = silent;
  worker?.terminate();
  worker = null;
  rejectPending?.(Object.assign(new Error('操作已取消。'), { cancelled: true }));
  rejectPending = null;
  busy.value = false;
  stage.value = '';
  percent.value = null;
}

function reportFailure(cause: unknown) {
  const err = cause as Error & { cancelled?: boolean };
  if (err.cancelled && silentCancel) return;
  error.value = err.message;
}

function offerFile(file: File) {
  if (!isSupportedImageFile(file)) { error.value = '仅支持 JPEG、PNG 和 WebP 文件；HEIC、AVIF 暂未开放。'; return; }
  if (dirty.value) {
    pendingFile.value = file;
    confirmKind.value = 'replace';
    confirmOpen.value = true;
  } else void loadFile(file);
}

function clearForms() {
  editKey.value = '';
  rawBlockId.value = '';
  rawHex.value = '';
  rawBlockLarge.value = false;
  newBlockKind.value = '';
  newBlockHex.value = '';
  newGroup.value = 'IFD0';
  newXmpPrefix.value = '';
  newTag.value = '';
  newType.value = 'string';
  newValue.value = '';
  newNamespaceUri.value = '';
  addTouched.value = false;
}

async function loadFile(file: File) {
  if (busy.value) cancel(true);
  try {
    const result = await run({ type: 'inspect', file, original: file });
    original.value = file;
    current.value = result;
    history.value = [result];
    historyIndex.value = 0;
    openGroups.value = [];
    query.value = '';
    groupFilter.value = 'all';
    showOriginal.value = false;
    clearForms();
    reset();
  } catch (cause) { reportFailure(cause); }
}

async function apply(action: ExifOperation) {
  if (!current.value || !original.value || busy.value) return;
  try {
    const result = await run({ ...action, file: current.value.file, original: original.value });
    history.value = [...history.value.slice(0, historyIndex.value + 1), result];
    historyIndex.value++;
    current.value = result;
    editKey.value = '';
    rawBlockId.value = '';
    if (groupFilter.value !== 'all' && !result.fields.some(field => field.group === groupFilter.value))
      groupFilter.value = 'all';
  } catch (cause) { reportFailure(cause); }
}

function undo() {
  if (historyIndex.value <= 0) return;
  current.value = history.value[--historyIndex.value];
}
function redo() {
  if (historyIndex.value >= history.value.length - 1) return;
  current.value = history.value[++historyIndex.value];
}
function askReset() {
  confirmKind.value = 'reset';
  confirmOpen.value = true;
}
function confirmChoice() {
  if (confirmKind.value === 'replace' && pendingFile.value) void loadFile(pendingFile.value);
  if (confirmKind.value === 'reset' && history.value[0]) {
    history.value = [history.value[0]];
    historyIndex.value = 0;
    current.value = history.value[0];
    clearForms();
  }
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
  addTouched.value = true;
  if (newFieldError.value) return;
  void apply({ type: 'add', group: effectiveGroup.value, identifier: newTag.value.trim(),
    dataType: newType.value.trim(), value: newValue.value, namespaceUri: newNamespaceUri.value.trim() || undefined });
}
async function startRaw(id: string) {
  if (!current.value) return;
  const block = current.value.blocks.find(item => item.id === id);
  if (!block) return;
  const bytes = new Uint8Array(await current.value.file.arrayBuffer());
  rawBlockId.value = id;
  rawBlockLarge.value = block.dataEnd - block.dataStart > largeBlockBytes;
  rawHex.value = bytesToHex(bytes.subarray(block.dataStart, block.dataEnd));
}
function toggleAll() {
  openGroups.value = openGroups.value.length === otherGroups.value.length ? [] : otherGroups.value.map(group => group.name);
}
function download() {
  if (!current.value || busy.value) return;
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
          <div ref="dropZone" class="flex min-h-72 items-center justify-center overflow-hidden rounded-xl border border-dashed p-4"
            :class="isOverDropZone ? 'border-primary bg-accent' : 'border-border'">
            <div v-if="!current" class="flex flex-col items-center gap-2 text-center">
              <ImageUp class="size-8 text-muted-foreground" aria-hidden="true" />
              <p>选择、拖入或粘贴一张 JPEG、PNG、WebP 图片</p>
              <Button :disabled="busy" @click="open()">选择图片</Button>
            </div>
            <img v-else-if="displayUrl && !previewFailed" :src="displayUrl" :alt="showOriginal ? '原始图片' : '待保存图片'"
              class="max-h-[28rem] max-w-full object-contain" @error="previewFailed = true" />
            <p v-else role="status" class="text-sm text-destructive">当前图片无法预览；原始块编辑可能已破坏文件结构。</p>
          </div>
          <div v-if="current" class="flex flex-wrap items-center gap-2">
            <Button variant="outline" :disabled="busy" @click="open()">替换图片</Button>
            <Button variant="outline" :disabled="busy" @click="showOriginal = !showOriginal">{{ showOriginal ? '查看待保存版本' : '查看原图' }}</Button>
            <Button variant="outline" :disabled="busy || historyIndex <= 0" aria-label="撤销" @click="undo"><RotateCcw />撤销</Button>
            <Button variant="outline" :disabled="busy || historyIndex >= history.length - 1" aria-label="重做" @click="redo"><RotateCw />重做</Button>
            <Button variant="outline" :disabled="busy || !dirty" @click="askReset">恢复原文件</Button>
            <Button :disabled="busy" @click="download">下载待保存文件</Button>
          </div>
        </CardContent>
      </Card>

      <div v-if="current || busy || error" class="flex min-h-14 flex-col justify-center gap-2">
        <div v-if="busy" role="status" aria-live="polite" class="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3 text-sm">
          <span>{{ stage }}{{ percent === null ? '' : ` ${percent}%` }}</span>
          <Button variant="outline" size="sm" @click="cancel()">取消操作</Button>
        </div>
        <p v-else-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
      </div>

      <template v-if="current">
        <Card>
          <CardHeader><CardTitle>当前待保存状态</CardTitle></CardHeader>
          <CardContent class="grid gap-2 text-sm sm:grid-cols-2">
            <p>格式：{{ current.format.toUpperCase() }}{{ current.animated ? ' · 动画' : '' }}</p>
            <p>GPS：{{ gpsPresent ? '存在' : '未发现' }}</p>
            <p>字段：{{ current.fields.length }} 项；未知附加块：{{ unknownBlocks.length }} 个</p>
            <p>图像数据：{{ current.imageUnchanged === true ? '与原文件一致' : current.imageUnchanged === false ? '已改变' : '无法确认' }}</p>
            <p v-if="originalSigned" class="sm:col-span-2">原文件包含 C2PA 等签名来源信息；{{ modified ? '当前修改可能使签名失效或已将其移除。' : '修改文件后签名可能失效。' }}</p>
            <p v-if="current.unsupportedMultiImage" class="sm:col-span-2 text-destructive">此多图 JPEG 变体仅支持查看，暂不支持编辑导出。</p>
            <p v-if="current.warning" role="alert" class="sm:col-span-2 text-destructive">{{ current.warning }}</p>
            <p v-if="unknownBlocks.length" class="sm:col-span-2 text-muted-foreground">未知附加块将在普通清理中保留；强力清理会移除。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>清理元数据</CardTitle></CardHeader>
          <CardContent class="flex flex-col gap-3">
            <div class="flex flex-wrap gap-2">
              <Button :disabled="busy || current.unsupportedMultiImage" @click="apply({ type: 'clear', mode: 'normal' })">普通清理</Button>
              <Button variant="destructive" :disabled="busy || current.unsupportedMultiImage" @click="apply({ type: 'clear', mode: 'strong' })">强力清理</Button>
            </div>
            <p class="text-sm text-muted-foreground">普通清理保留方向、色彩配置与未知附加块。</p>
            <p class="text-sm text-destructive">强力清理会删除方向、ICC 等显示相关信息，图片可能旋转或偏色；只有通过结构与图像数据校验才会生成结果。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>常用信息</CardTitle><CardDescription>这里汇总了含义明确的常见元数据，可点圈问号查看说明；如需修改字段值，请前往下方“全部元数据”。</CardDescription></CardHeader>
          <CardContent>
            <p v-if="!commonFields.length" class="text-sm text-muted-foreground">未发现常用的元数据字段。</p>
            <ExifCommonField v-for="field in commonFields" :key="field.key" :field="field"
              :busy="busy" :locked="current.unsupportedMultiImage" @remove="removeField(field)" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>全部元数据</CardTitle><CardDescription>按字段名、值和来源筛选；同义字段按各自来源独立显示。</CardDescription></CardHeader>
          <CardContent class="flex flex-col gap-4">
            <div class="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
              <Input v-model="query" aria-label="搜索元数据" placeholder="搜索字段名或值" />
              <Select v-model="groupFilter" :items="filterItems" label="筛选元数据来源" />
              <Button variant="outline" @click="toggleAll">{{ openGroups.length === otherGroups.length ? '全部收起' : '展开非空类别' }}</Button>
            </div>
            <AccordionRoot v-model="openGroups" type="multiple" class="rounded-lg border">
              <AccordionItem v-for="group in otherGroups" :key="group.name" :value="group.name" class="border-b last:border-b-0">
                <AccordionHeader>
                  <AccordionTrigger class="flex w-full items-center justify-between p-3 text-left font-medium hover:bg-accent/50">
                    {{ group.name }}（{{ group.fields.length }}）<ChevronDown class="size-4" aria-hidden="true" />
                  </AccordionTrigger>
                </AccordionHeader>
                <AccordionContent class="px-3 pb-3">
                  <ExifFieldRow v-for="field in group.fields" :key="field.key" :field="field"
                    :editing="editKey === field.key" :busy="busy" :locked="current.unsupportedMultiImage"
                    @edit="startEdit(field)" @apply="value => applyEdit(field, value)"
                    @remove="removeField(field)" @cancel="editKey = ''" />
                </AccordionContent>
              </AccordionItem>
            </AccordionRoot>
            <p v-if="!otherGroups.length" class="text-sm text-muted-foreground">没有其他匹配的元数据字段。</p>

            <div class="flex flex-col gap-2 border-t pt-4">
              <h3 class="font-medium">新增字段</h3>
              <p class="text-sm text-muted-foreground">层级与类型从受支持集合中选择；无法字段级写入的私有结构可使用下方原始块编辑。</p>
              <div class="grid gap-2 sm:grid-cols-3">
                <Select v-model="newGroup" :items="groupItems" label="字段层级" />
                <Input v-if="newGroup === 'XMP'" v-model="newXmpPrefix" aria-label="XMP 命名空间前缀" placeholder="前缀，例如 dc" />
                <Input v-model="newTag" aria-label="字段标识" :placeholder="identifierPlaceholder" @input="addTouched = true" />
                <Select v-model="newType" :items="dataTypeItems" label="字段类型" />
              </div>
              <Input v-model="newValue" aria-label="字段值" placeholder="字段值" @input="addTouched = true" />
              <Input v-if="newGroup === 'XMP'" v-model="newNamespaceUri" aria-label="自定义 XMP 命名空间 URI" placeholder="自定义 XMP 命名空间 URI（现有命名空间可留空）" />
              <p class="min-h-5 text-xs text-destructive" :role="newFieldVisibleError ? 'alert' : undefined">{{ newFieldVisibleError }}</p>
              <Button class="self-start" :disabled="busy || current.unsupportedMultiImage" @click="addField">新增字段</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>原始附加块</CardTitle><CardDescription>十六进制编辑可改变块长度；请自行确认内部字段结构。损坏结果会带强警告，仍可下载。</CardDescription></CardHeader>
          <CardContent class="flex flex-col gap-3">
            <div v-for="block in current.blocks" :key="block.id" class="rounded-lg border p-3">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm"><strong>{{ block.label }}</strong> · {{ block.dataEnd - block.dataStart }} 字节{{ block.known ? '' : ' · 未知' }}</p>
                <Button v-if="block.kind !== 'Trailer'" variant="outline" size="sm" :disabled="busy || current.unsupportedMultiImage" @click="startRaw(block.id)">编辑原始块</Button>
              </div>
              <div v-if="rawBlockId === block.id" class="mt-3 flex flex-col gap-2">
                <Textarea v-model="rawHex" :aria-label="`编辑 ${block.label} 十六进制字节`" class="min-h-40 font-mono text-xs" />
                <p class="min-h-5 text-xs" :class="rawHexError ? 'text-destructive' : 'text-muted-foreground'" :role="rawHexError ? 'alert' : undefined">
                  {{ rawHexError || rawBlockHexInfo }}
                </p>
                <div class="flex gap-2"><Button size="sm" :disabled="busy" @click="apply({ type: 'raw', blockId: block.id, hex: rawHex })">应用原始编辑</Button>
                  <Button size="sm" variant="ghost" @click="rawBlockId = ''">取消</Button></div>
              </div>
            </div>
            <div class="flex flex-col gap-2 border-t pt-4">
              <h3 class="font-medium">新增原始附加块</h3>
              <p class="text-sm text-muted-foreground">JPEG 使用 APP0–APP15 或 COM；PNG 使用四字母辅助块名；WebP 使用四字母块名。</p>
              <Input v-model="newBlockKind" aria-label="新块类型" placeholder="块类型，例如 APP1、iTXt、XMP" />
              <Textarea v-model="newBlockHex" aria-label="新块十六进制字节" class="min-h-28 font-mono text-xs" placeholder="十六进制原始字节" />
              <p class="min-h-5 text-xs" :class="newBlockErrorText ? 'text-destructive' : 'text-muted-foreground'" :role="newBlockErrorText ? 'alert' : undefined">
                {{ newBlockErrorText || (newBlockHex.trim() ? `当前 ${hexByteCount(newBlockHex)} 字节` : '') }}
              </p>
              <Button class="self-start" :disabled="busy || current.unsupportedMultiImage" @click="apply({ type: 'addBlock', kind: newBlockKind, hex: newBlockHex })">新增原始块</Button>
            </div>
          </CardContent>
        </Card>
      </template>
    </div>

    <AlertDialogRoot v-model:open="confirmOpen">
      <AlertDialogPortal>
        <AlertDialogOverlay class="fixed inset-0 z-50 bg-foreground/50" />
        <AlertDialogContent class="fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-6 shadow-lg">
          <AlertDialogTitle class="text-lg font-semibold">{{ confirmKind === 'replace' ? '替换当前图片？' : '恢复原文件？' }}</AlertDialogTitle>
          <AlertDialogDescription class="mt-2 text-sm text-muted-foreground">当前修改及撤销历史将丢失。</AlertDialogDescription>
          <div class="mt-5 flex justify-end gap-2">
            <AlertDialogCancel as-child><Button variant="outline" @click="pendingFile = null">取消</Button></AlertDialogCancel>
            <AlertDialogAction as-child><Button @click="confirmChoice">继续</Button></AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>
  </ToolPage>
</template>
