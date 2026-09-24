<script setup lang="ts">
import { computed, ref } from 'vue';
import ToolPage from '@/components/ToolPage.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useClipboardActions } from '@/composables/useClipboardActions';
import { findInvalidChineseIds } from '@/lib/chineseId';

const text = ref('');
const invalidIds = computed(() => findInvalidChineseIds(text.value));
const idCount = computed(() => text.value.split(/\r?\n/).filter((line) => line.trim()).length);
const { clipboardError, readText } = useClipboardActions();

async function paste() {
  const value = await readText();
  if (value !== null) text.value = value;
}
</script>

<template>
  <ToolPage>
    <Card>
      <CardHeader><CardTitle>身份证号码</CardTitle></CardHeader>
      <CardContent class="space-y-4">
        <label for="chinese-id-list" class="text-sm font-medium">每行一个号码</label>
        <Textarea
          id="chinese-id-list"
          v-model="text"
          class="min-h-64 resize-y"
          monospace
          show-line-numbers
          placeholder="例如：&#10;11010519491231002X"
          :aria-invalid="invalidIds.length > 0"
          aria-describedby="chinese-id-help validation-result"
        />
        <p id="chinese-id-help" class="text-sm text-muted-foreground">
          空行会被忽略，末位 X 不区分大小写。
        </p>
        <div class="flex gap-2">
          <Button variant="secondary" @click="paste">粘贴</Button>
          <Button variant="outline" :disabled="!text" @click="text = ''">清空</Button>
        </div>
        <p v-if="clipboardError" role="alert" class="text-sm text-destructive">
          {{ clipboardError }}
        </p>
      </CardContent>
    </Card>

    <Card id="validation-result" aria-live="polite">
      <CardHeader><CardTitle>校验结果</CardTitle></CardHeader>
      <CardContent>
        <p v-if="!idCount" class="text-sm text-muted-foreground">输入身份证号码后显示结果。</p>
        <p
          v-else-if="!invalidIds.length"
          role="status"
          class="text-sm font-medium text-green-700 dark:text-green-400"
        >
          {{ idCount }} 个身份证号码均通过校验。
        </p>
        <div v-else role="alert" class="space-y-3">
          <p class="text-sm font-medium text-destructive">
            以下 {{ invalidIds.length }} 个身份证号码未通过校验：
          </p>
          <ul class="space-y-2 font-mono text-sm">
            <li
              v-for="item in invalidIds"
              :key="item.line"
              class="break-all rounded-lg bg-destructive/10 px-3 py-2 text-destructive"
            >
              第 {{ item.line }} 行：{{ item.id }}（{{ item.reason
              }}<template v-if="item.reason === '长度不对'">，应为 18 位</template
              ><template v-if="item.expectedCheckCode"
                >；校验码应为 {{ item.expectedCheckCode }}</template
              >）
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  </ToolPage>
</template>
