<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { Download, FileText, ImageUp, Loader2, RotateCcw, Upload } from '@lucide/vue';
import { useDropZone, useFileDialog } from '@vueuse/core';
import ToolPage from '@/components/ToolPage.vue';
import TicketImagePreview from '@/components/ticket/TicketImagePreview.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { extractXmlFromOFDBytes } from '@/lib/ticket/ofdParser';
import { extractXmlFromPDFBytes } from '@/lib/ticket/pdfParser';
import { parseXBRL } from '@/lib/ticket/xmlParser';
import {
  formatDate,
  formatMoney,
  ticketFieldRows,
  toTicket,
  type Ticket,
  type TicketParseResult,
} from '@/lib/ticket/types';

const TICKET_FILE_PATTERN = /\.(ofd|pdf)$/i;

/**
 * 发给 worker/postMessage 的载荷不能是 Vue reactive Proxy；这里只整体替换，
 * 不就地把改。
 */
const result = shallowRef<TicketParseResult | null>(null);
const xmlFileName = ref('');
const sourceFileName = ref('');
const parsing = ref(false);
const parseError = ref('');

/** 领域模型，供车票图片渲染与业务逻辑使用 */
const ticket = computed(() => (result.value ? toTicket(result.value.ticket) : null));

/**
 * 常用信息：精选一屏能看完的票面要素。
 * 字段明细（默认折叠）用 ticketFieldRows 给出全部字段，详见下方。
 */
interface KeyValueRow {
  label: string;
  value: string;
}

function asString(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

const seatFull = (t: Ticket): string =>
  [asString(t.seatLevel), asString(t.carriage) + asString(t.seat)]
    .filter((part) => part.length > 0)
    .join(' ')
    .trim();

/** 把日期与时间拼成一个可读字符串：任一缺失就只显示存在的部分 */
function formatDateTime(dateStr: string | null, timeStr: string | null): string {
  const date = formatDate(dateStr);
  const time = asString(timeStr);
  if (date && time) return `${date} ${time}`;
  return date || time;
}

const keyInfoEntries = computed<KeyValueRow[]>(() => {
  const t = ticket.value;
  if (!t) return [];

  const rows: KeyValueRow[] = [
    { label: '车次', value: asString(t.trainNumber) },
    { label: '出发站', value: asString(t.fromStation) },
    { label: '到达站', value: asString(t.toStation) },
    { label: '出发时间', value: formatDateTime(t.travelDate, t.departureTime) },
    { label: '席别 / 座位', value: seatFull(t) },
    { label: '支付金额', value: t.amount !== null ? `¥ ${formatMoney(t.amount)}` : '' },
    { label: '姓名', value: asString(t.passengerName) },
    { label: '证件号', value: asString(t.passengerIdNumber) },
    { label: '数电票号', value: asString(t.invoiceNumber) },
  ];
  return rows.filter((row) => row.value !== '');
});

/** 完整字段明细（始终包含税额、企业信息等"默认隐藏"的字段） */
const fieldRows = computed(() =>
  result.value ? ticketFieldRows(result.value.ticket, { includeHidden: true }) : []
);

/** 架构外的意外元素，正常情况下为空 */
const extraEntries = computed(() => Object.entries(result.value?.extra ?? {}));

/** 完整 JSON，下载与原始展示共用 */
const ticketJson = computed(() =>
  result.value ? JSON.stringify(result.value.ticket, null, 2) : ''
);

/** JSON 下载文件名，沿用附件原名；空时回退为 sourceName */
const downloadJsonName = computed(() => {
  const base = (xmlFileName.value || sourceFileName.value || 'ticket').replace(
    /\.(ofd|pdf|xml)$/i,
    ''
  );
  return `${base}.json`;
});

const dropZone = ref<HTMLElement | null>(null);
const fileDialog = useFileDialog({
  accept: '.ofd,.pdf,application/pdf',
  multiple: false,
  reset: true,
});

fileDialog.onChange((files) => {
  const file = files?.[0];
  if (file) void handleFile(file);
});

const { isOverDropZone } = useDropZone(dropZone, {
  multiple: false,
  preventDefaultForUnhandled: true,
  /**
   * DataTransferItem 上没有文件名，只能用 kind 粗筛。OFD 没有官方 MIME，
   * 所以接受所有文件型项；扩展名在 onDrop 里再校一次。
   */
  checkValidity: (items) => [...items].every((item) => item.kind === 'file'),
  onDrop: (files) => {
    const file = files?.[0];
    if (file) void handleFile(file);
    else parseError.value = '请拖入 .ofd 或 .pdf 文件。';
  },
});

async function handleFile(file: File) {
  // 先清掉上一次的结果。选新文件就是换内容，新文件不合格时如果还留着上一张票的
  // 字段和「下载 JSON」按钮，用户会以为下到的是刚选的那个文件。
  result.value = null;
  xmlFileName.value = '';

  if (!TICKET_FILE_PATTERN.test(file.name)) {
    parseError.value = `不支持的文件格式：${file.name}。仅支持 .ofd 和 .pdf。`;
    return;
  }

  parsing.value = true;
  parseError.value = '';
  sourceFileName.value = file.name;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const lowerName = file.name.toLowerCase();

    let xml: string;
    let attachedFileName: string;
    if (lowerName.endsWith('.ofd')) {
      const ofdResult = await extractXmlFromOFDBytes(bytes);
      xml = ofdResult.xmlContent;
      attachedFileName = ofdResult.fileName;
    } else if (lowerName.endsWith('.pdf')) {
      const pdfResult = await extractXmlFromPDFBytes(bytes);
      xml = pdfResult.xmlContent;
      attachedFileName = pdfResult.fileName;
    } else {
      throw new Error('不支持的文件格式，仅支持 .ofd 和 .pdf');
    }

    result.value = parseXBRL(xml);
    xmlFileName.value = attachedFileName;
  } catch (err) {
    parseError.value = err instanceof Error ? err.message : '解析失败';
  } finally {
    parsing.value = false;
  }
}

function clearResult() {
  result.value = null;
  xmlFileName.value = '';
  sourceFileName.value = '';
  parseError.value = '';
  fileDialog.reset();
}

function downloadJson() {
  if (!ticketJson.value) return;
  const blob = new Blob([ticketJson.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadJsonName.value;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <ToolPage>
    <Card>
      <CardHeader>
        <div class="flex items-center justify-between gap-3">
          <CardTitle>上传电子客票</CardTitle>
          <Button
            v-if="sourceFileName || parseError"
            variant="ghost"
            size="sm"
            @click="clearResult"
          >
            <RotateCcw class="mr-1 size-4" aria-hidden="true" />
            清除
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <div
          ref="dropZone"
          role="button"
          tabindex="0"
          class="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          :class="isOverDropZone ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'"
          aria-label="选择或拖入 .ofd 或 .pdf 电子客票文件"
          @click="fileDialog.open()"
          @keydown.enter.prevent="fileDialog.open()"
          @keydown.space.prevent="fileDialog.open()"
        >
          <template v-if="parsing">
            <Loader2 class="mb-2 size-8 animate-spin text-muted-foreground" aria-hidden="true" />
            <p class="text-sm text-muted-foreground">解析中…</p>
          </template>
          <template v-else-if="sourceFileName">
            <FileText class="mb-2 size-8 text-muted-foreground" aria-hidden="true" />
            <p class="font-medium break-all">{{ sourceFileName }}</p>
            <p v-if="xmlFileName" class="mt-1 text-xs text-muted-foreground">
              提取附件：{{ xmlFileName }}
            </p>
            <p v-else class="mt-1 text-xs text-muted-foreground">点击或拖入替换文件</p>
          </template>
          <template v-else>
            <ImageUp class="mb-3 size-8 text-muted-foreground" aria-hidden="true" />
            <p class="font-medium">点击选择文件，或将文件拖到这里</p>
            <p class="mt-1 text-sm text-muted-foreground">
              支持 .ofd 和 .pdf（中国铁路电子客票），文件只在当前浏览器中处理
            </p>
          </template>
        </div>
        <p
          v-if="parseError"
          role="alert"
          class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {{ parseError }}
        </p>
      </CardContent>
    </Card>

    <Card v-if="result">
      <CardHeader>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>解析结果</CardTitle>
            <p v-if="xmlFileName" class="mt-1 text-xs text-muted-foreground">
              提取附件：{{ xmlFileName }}
            </p>
          </div>
          <Button variant="outline" size="sm" @click="downloadJson">
            <Download class="mr-1 size-4" aria-hidden="true" />
            下载 JSON
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-6">
        <!-- 常用信息：一屏能看完的票面要素 -->
        <section aria-labelledby="ticket-key-info">
          <h3 id="ticket-key-info" class="mb-2 text-sm font-semibold">常用信息</h3>
          <dl
            v-if="keyInfoEntries.length"
            class="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3"
          >
            <div
              v-for="row in keyInfoEntries"
              :key="row.label"
              class="flex items-baseline gap-2 min-w-0"
            >
              <dt class="w-14 shrink-0 text-xs text-muted-foreground">{{ row.label }}</dt>
              <dd class="min-w-0 font-medium break-all">{{ row.value }}</dd>
            </div>
          </dl>
          <p v-else class="text-sm text-muted-foreground">
            解析结果没有任何非空字段，可能是非铁路电子客票文件。
          </p>
        </section>

        <!-- 字段明细：默认折叠，需要看细项时再展开 -->
        <details class="rounded-md border border-border bg-card text-sm">
          <summary
            class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 select-none"
          >
            <span class="font-semibold">字段明细（{{ fieldRows.length }} 个）</span>
            <span class="text-xs text-muted-foreground">点击展开</span>
          </summary>
          <div class="space-y-3 px-4 pb-4">
            <div class="overflow-x-auto rounded-md border border-border">
              <table class="w-full text-sm">
                <tbody>
                  <tr
                    v-for="row in fieldRows"
                    :key="row.name"
                    class="border-b border-border/60 last:border-b-0"
                  >
                    <th scope="row" class="w-32 bg-muted/30 px-3 py-1.5 text-left font-medium">
                      {{ row.label }}
                    </th>
                    <td class="w-56 px-3 py-1.5 font-mono text-xs text-muted-foreground break-all">
                      {{ row.name }}
                    </td>
                    <td class="px-3 py-1.5 break-all">{{ row.value }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-if="extraEntries.length"
              class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
            >
              <p class="text-sm font-medium">以下字段不在铁路电子客票架构中，原样保留：</p>
              <p class="mt-1 flex flex-wrap gap-1.5 text-xs">
                <span
                  v-for="[key, value] in extraEntries"
                  :key="key"
                  class="inline-block rounded bg-amber-100 px-1.5 py-0.5 font-mono dark:bg-amber-900/40"
                >
                  {{ key }} = {{ value }}
                </span>
              </p>
            </div>

            <details class="text-xs">
              <summary class="cursor-pointer select-none text-muted-foreground">
                原始 JSON（{{ ticketJson.length.toLocaleString() }} 字符）
              </summary>
              <pre
                class="mt-2 max-h-96 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed"
              ><code>{{ ticketJson }}</code></pre>
            </details>
          </div>
        </details>
      </CardContent>
    </Card>

    <TicketImagePreview v-if="ticket" :ticket="ticket" />

    <p v-if="!result" class="text-xs text-muted-foreground">
      <Upload class="mr-1 inline-block size-3 align-text-bottom" aria-hidden="true" />
      支持 OFD（GB/T 33190）和 PDF（中国铁路 12306 电子客票格式）。
      所有解析在当前浏览器中完成，文件不会上传到任何服务器。
    </p>
  </ToolPage>
</template>
