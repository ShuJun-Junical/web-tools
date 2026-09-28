<script setup lang="ts">
import { computed } from 'vue';
import ToolPage from '@/components/ToolPage.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useNumberLinesInput } from '@/composables/useNumberLinesInput';
import { summarize } from '@/lib/statistics';

const { text, parsed, hasError, errorMessage, clear } = useNumberLinesInput();
const summary = computed(() => (hasError.value ? null : summarize(parsed.value.values)));

const results = computed(() =>
  summary.value
    ? [
        ['数量', summary.value.count],
        ['总和', summary.value.sum],
        ['平均值', summary.value.mean],
        ['总体方差', summary.value.variance],
        ['总体标准差', summary.value.standardDeviation],
        ['最小值', summary.value.min],
        ['最大值', summary.value.max],
        ['中位数', summary.value.median],
        ['众数', summary.value.modes.length ? summary.value.modes.join('、') : '无众数'],
      ]
    : []
);
</script>

<template>
  <ToolPage>
    <Card>
      <CardHeader><CardTitle>输入数据</CardTitle></CardHeader>
      <CardContent class="space-y-4">
        <label for="statistics-data" class="text-sm font-medium">数字列表</label>
        <Textarea
          id="statistics-data"
          v-model="text"
          class="min-h-52 resize-y"
          monospace
          placeholder="例如：&#10;12&#10;18.5&#10;20"
          :aria-invalid="hasError"
          aria-describedby="statistics-help statistics-error"
        />
        <p id="statistics-help" class="text-sm text-muted-foreground">空行会被忽略。</p>
        <p
          v-if="hasError"
          id="statistics-error"
          role="alert"
          class="text-sm text-destructive"
        >
          {{ errorMessage }}
        </p>
        <Button variant="outline" :disabled="!text" @click="clear">清空</Button>
      </CardContent>
    </Card>

    <Card aria-live="polite">
      <CardHeader><CardTitle>计算结果</CardTitle></CardHeader>
      <CardContent>
        <p v-if="!summary" class="text-sm text-muted-foreground">
          {{ hasError ? '输入包含错误。' : '输入数据后显示结果。' }}
        </p>
        <dl v-else class="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="[label, value] in results" :key="label" class="rounded-lg bg-muted/60 p-3">
            <dt class="text-sm text-muted-foreground">{{ label }}</dt>
            <dd class="mt-1 break-all font-semibold tabular-nums">{{ value }}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  </ToolPage>
</template>
