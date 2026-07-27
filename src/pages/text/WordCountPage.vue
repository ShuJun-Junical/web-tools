<script setup lang="ts">
import { computed, ref } from 'vue';
import ToolPage from '@/components/ToolPage.vue';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  analyzeText,
  supportsGraphemeSegmentation,
} from '@/lib/text-statistics';

const text = ref('');
const statistics = computed(() =>
  text.value ? analyzeText(text.value) : null,
);

const groups = computed(() => {
  const result = statistics.value;
  if (!result) return [];

  return [
    {
      title: '论文常用口径',
      description: '只统计当前输入的文本，不识别封面、摘要、正文或参考文献。',
      items: [
        [
          '论文字符数（不计空白）',
          result.thesisCharacters,
          '排除 Unicode 空白，标点和符号计入。',
        ],
        [
          '净字符数（不计空白、标点）',
          result.thesisCharactersWithoutPunctuation,
          '排除 Unicode 空白和标点。',
        ],
        [
          '中英混排字数',
          result.mixedWords,
          '每个汉字计 1，连续拉丁字母或数字计 1。',
        ],
        ['汉字数', result.hanCharacters, '统一汉字及“〇”，不含标点。'],
        [
          '英文单词数',
          result.latinWords,
          '连续拉丁字母计 1，内部撇号连接，连字符分词。',
        ],
      ],
    },
    {
      title: '字符组成',
      description: '按 Unicode 字符属性和用户感知字符分别统计。',
      items: [
        [
          '总字符数（可见字符）',
          result.visibleCharacters,
          '空白计入；组合字符和完整 emoji 各计 1。',
        ],
        [
          '去换行字符数',
          result.charactersWithoutLineBreaks,
          '仅排除 CR 和 LF，其他空白保留。',
        ],
        ['拉丁字母数', result.latinLetters, '包括带重音符号的拉丁字母。'],
        [
          '数字字符数',
          result.digitCharacters,
          'Unicode 十进制数字，每位计 1。',
        ],
        ['标点符号数', result.punctuationCharacters, 'Unicode 标点类别字符。'],
        [
          '空白字符数',
          result.whitespaceCharacters,
          '包括空格、全角空格、Tab 和换行。',
        ],
      ],
    },
    {
      title: '文本结构',
      description: '换行决定行数，空白行负责分隔段落。',
      items: [
        ['行数', result.lines, '末尾换行会产生一个空行。'],
        ['非空行数', result.nonEmptyLines, '排除只包含空白的行。'],
        ['段落数', result.paragraphs, '连续非空行视为一个段落。'],
      ],
    },
    {
      title: '技术口径',
      description: '用于对照程序、接口、数据库和文件长度限制。',
      items: [
        ['Unicode 码点数', result.codePoints, '每个 Unicode 码点计 1。'],
        ['UTF-16 长度', result.utf16Units, 'JavaScript 字符串代码单元数量。'],
        ['UTF-8 字节数', result.utf8Bytes, '文本编码为 UTF-8 后的字节数量。'],
      ],
    },
  ];
});
</script>

<template>
  <ToolPage>
    <Card>
      <CardHeader>
        <CardTitle>输入文本</CardTitle>
        <CardDescription
          >所有统计均在浏览器本地实时完成，不保存输入内容。</CardDescription
        >
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <label for="word-count-text" class="text-sm font-medium"
          >待统计文本</label
        >
        <Textarea
          id="word-count-text"
          v-model="text"
          class="min-h-72 resize-y"
          show-line-numbers
          placeholder="输入或粘贴需要统计的文本"
          :aria-describedby="
            supportsGraphemeSegmentation
              ? 'word-count-help'
              : 'word-count-help word-count-support'
          "
        />
        <p id="word-count-help" class="text-sm text-muted-foreground">
          如需统计论文正文，请只粘贴正文；页面不会判断论文组成部分。
        </p>
        <p
          v-if="!supportsGraphemeSegmentation"
          id="word-count-support"
          role="alert"
          class="text-sm text-destructive"
        >
          当前浏览器不支持 Unicode 字素分段，总字符数暂按 Unicode 码点统计。
        </p>
        <Button
          variant="outline"
          class="self-start"
          :disabled="!text"
          @click="text = ''"
        >
          清空
        </Button>
      </CardContent>
    </Card>

    <div v-if="statistics" class="flex flex-col gap-6">
      <Card v-for="group in groups" :key="group.title">
        <CardHeader>
          <CardTitle>{{ group.title }}</CardTitle>
          <CardDescription>{{ group.description }}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="[label, value, description] in group.items"
              :key="label"
              class="rounded-lg bg-muted/60 p-4"
            >
              <dt class="text-sm font-medium">{{ label }}</dt>
              <dd class="mt-2 text-2xl font-semibold tabular-nums">
                {{ value }}
              </dd>
              <dd class="mt-2 text-xs leading-5 text-muted-foreground">
                {{ description }}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  </ToolPage>
</template>
