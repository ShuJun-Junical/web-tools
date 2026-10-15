<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Download, Loader2 } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import {
  TICKET_PLACEHOLDERS,
  downloadImage,
  generateTicketImage,
  type PlaceholderKey,
} from './imageGenerator';
import { text, type Ticket } from './types';

interface Props {
  ticket: Ticket;
}

const props = defineProps<Props>();

interface TemplateOption {
  label: string;
  value: string;
}

const TEMPLATES: TemplateOption[] = [
  { label: '经典样式', value: '/ticket-template.svg' },
  { label: '现代样式', value: '/templates/modern.svg' },
];

const imageUrl = ref('');
const generating = ref(false);
const errorMessage = ref('');
const useTemplate = ref(true);
const templateUrl = ref<string>(TEMPLATES[0]!.value);
const hideIdNumber = ref(false);

/**
 * 生成序号
 *
 * `generateTicketImage` 要经历 fetch + 图片解码 + 画布绘制，连续切换模板时后一次
 * 可能先返回。没有序号兜底时，旧模板的结果会覆盖新模板。比对序号丢弃过期结果。
 */
let generateToken = 0;

// 模板里不能直接写 `{{` 字面量——Vue 会把它当插值开头，所以从脚本注入
const placeholderSyntax = '{{key}}';

const resolvedTemplate = computed(() => (useTemplate.value ? templateUrl.value : null));

/**
 * 占位符清单
 *
 * 直接渲染自 `TICKET_PLACEHOLDERS`——和模板渲染器读的是同一个常量，
 * 所以做模板时看到的清单永远不过期。
 */
const placeholderList = computed(() =>
  (Object.keys(TICKET_PLACEHOLDERS) as PlaceholderKey[]).map((key) => ({
    key,
    label: TICKET_PLACEHOLDERS[key].label,
  }))
);

const isRendering = computed(() => generating.value);

async function generateImage() {
  const token = ++generateToken;
  generating.value = true;
  errorMessage.value = '';
  try {
    const next = await generateTicketImage(props.ticket, {
      ...(resolvedTemplate.value ? { templateUrl: resolvedTemplate.value } : {}),
      hideIdNumber: hideIdNumber.value,
    });
    if (token !== generateToken) return;
    imageUrl.value = next;
  } catch (err) {
    if (token !== generateToken) return;
    imageUrl.value = '';
    errorMessage.value = err instanceof Error ? err.message : '生成图片失败';
  } finally {
    if (token === generateToken) generating.value = false;
  }
}

// 任一输入变更都重新生成。模板未挂载时跳过，避免 fetch 404 把整页拖死。
watch(
  () => props.ticket,
  () => {
    void generateImage();
  },
  { immediate: true }
);

watch([useTemplate, templateUrl, hideIdNumber], () => {
  void generateImage();
});

function handleDownload() {
  if (!imageUrl.value) return;
  const base = text(props.ticket.invoiceNumber) || 'ticket';
  downloadImage(imageUrl.value, `${base}.png`);
}
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>车票图片</CardTitle>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Checkbox v-model="useTemplate">使用 SVG 模板</Checkbox>
          <label v-if="useTemplate" class="flex items-center gap-1.5">
            <span class="text-muted-foreground">模板</span>
            <Select v-model="templateUrl" :items="TEMPLATES" label="车票图片模板" class="w-40" />
          </label>
          <Checkbox v-model="hideIdNumber">隐藏身份证号</Checkbox>
          <Button v-if="imageUrl && !isRendering" size="sm" @click="handleDownload">
            <Download class="mr-1 size-4" aria-hidden="true" />
            下载图片
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-3">
      <div
        v-if="generating"
        class="flex min-h-32 items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Loader2 class="size-4 animate-spin" aria-hidden="true" />
        生成图片中…
      </div>
      <div
        v-else-if="errorMessage"
        role="alert"
        class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
      >
        {{ errorMessage }}
      </div>
      <div v-else-if="imageUrl" class="flex flex-col items-center gap-2">
        <img
          :src="imageUrl"
          alt="车票图片预览"
          class="max-w-full rounded-md border border-border shadow-sm"
        />
        <p class="flex flex-wrap items-center justify-center gap-x-2 text-xs text-muted-foreground">
          尺寸: 85.6mm × 54mm @ 300dpi（1011 × 638 像素）
          <span
            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            :class="
              useTemplate
                ? 'bg-primary/10 text-primary'
                : 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
            "
          >
            {{ useTemplate ? 'SVG 模板' : 'Canvas 绘制' }}
          </span>
        </p>
      </div>

      <details v-if="useTemplate" class="rounded-md border bg-muted/30 p-3 text-sm">
        <summary class="cursor-pointer select-none text-muted-foreground">
          可用占位符（{{ placeholderList.length }} 个）
        </summary>
        <p class="mt-2 text-xs text-muted-foreground">
          在 SVG 模板里写
          <code class="rounded bg-background px-1 font-mono text-xs">{{ placeholderSyntax }}</code>
          引用。写错会在上方直接报错并指出正确写法。
        </p>
        <div class="mt-2 max-h-72 overflow-y-auto">
          <table class="w-full text-xs">
            <tbody>
              <tr
                v-for="p in placeholderList"
                :key="p.key"
                class="border-b border-border/40 last:border-b-0"
              >
                <td class="w-40 py-1 pr-2 align-top font-mono">{{ p.key }}</td>
                <td class="py-1 align-top text-muted-foreground">{{ p.label }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </CardContent>
  </Card>
</template>
