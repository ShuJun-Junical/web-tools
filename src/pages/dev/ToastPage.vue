<script setup lang="ts">
import ToolPage from '@/components/ToolPage.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/composables/useToast';

const { toasts, showToast, closeToast } = useToast();

const SUCCESS_MESSAGE = '已复制到剪贴板。';
const ERROR_MESSAGE = '这不是有效的 UTF-8 Base64 字符串';
const LONG_MESSAGE =
  '这是一条很长的提示，用来观察多行弹窗的高度、堆叠间距和从下方浮出的入场动画是否仍然自然。';

function showStack() {
  const stack = [
    { message: '第一条：已复制到剪贴板。', variant: 'success' },
    { message: '第二条：这不是有效的 URL 编码字符串', variant: 'error' },
    { message: '第三条：剪贴板内容不是有效的图片 Data URL', variant: 'error' },
    { message: '第四条：这不是有效的 Punycode 字符串', variant: 'error' },
    { message: '第五条：读取剪贴板失败，请检查浏览器权限。', variant: 'error' },
  ] as const;
  stack.forEach(({ message, variant }) => showToast(message, variant));
}

function repeatOldest() {
  const oldest = toasts.value.at(-1);
  if (oldest) showToast(oldest.message, oldest.variant);
}

function repeatMiddle() {
  const middle = toasts.value[Math.floor(toasts.value.length / 2)];
  if (middle) showToast(middle.message, middle.variant);
}

function closeAll() {
  toasts.value.forEach(closeToast);
}
</script>

<template>
  <ToolPage>
    <Card>
      <CardHeader><CardTitle>触发</CardTitle></CardHeader>
      <CardContent class="space-y-4">
        <div class="flex flex-wrap gap-2">
          <Button @click="showToast(SUCCESS_MESSAGE, 'success')">成功提示</Button>
          <Button variant="destructive" @click="showToast(ERROR_MESSAGE, 'error')">错误提示</Button>
          <Button variant="secondary" @click="showStack">一次堆五条</Button>
          <Button variant="secondary" :disabled="!toasts.length" @click="repeatOldest">
            重复最旧的一条
          </Button>
          <Button variant="secondary" :disabled="!toasts.length" @click="repeatMiddle">
            重复中间的一条
          </Button>
          <Button variant="secondary" @click="showToast(LONG_MESSAGE, 'error')">长文案</Button>
          <Button variant="outline" :disabled="!toasts.length" @click="closeAll">全部关闭</Button>
        </div>
        <p class="text-sm text-muted-foreground">
          连点同一个按钮就是"同内容重复触发"：旧弹窗先在原位淡出（250ms），淡出结束后同样内容从最下方重新浮出（400ms
          入场）。
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>队列状态</CardTitle></CardHeader>
      <CardContent class="space-y-3">
        <p v-if="!toasts.length" class="text-sm text-muted-foreground">当前没有弹窗。</p>
        <ul v-else class="flex flex-col gap-2">
          <li
            v-for="toast in toasts"
            :key="toast.id"
            class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-sm"
          >
            <span class="text-muted-foreground">#{{ toast.id }}</span>
            <span>{{ toast.variant === 'error' ? '错误' : '成功' }}</span>
            <span class="min-w-0 flex-1 truncate">{{ toast.message }}</span>
            <span
              :class="toast.open ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'"
            >
              {{ toast.open ? '显示中' : '淡出中' }}
            </span>
          </li>
        </ul>
        <p class="text-sm text-muted-foreground">
          列表按入队顺序（最新的在最上面），屏幕上是最新的一条在最下方。「淡出中」表示它已经在离场，等
          250ms 的淡出结束就移出队列；被重复触发的那条正是在这一刻用同样内容重新入队的。
        </p>
      </CardContent>
    </Card>
  </ToolPage>
</template>
