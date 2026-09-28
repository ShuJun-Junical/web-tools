<script setup lang="ts">
import { computed, ref } from 'vue';
import ToolPage from '@/components/ToolPage.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup } from '@/components/ui/radio-group';
import { useCodecPair } from '@/composables/useCodecPair';
import { codecSpecs, defaultCodecId, type CodecId } from './codec-config';

const codecId = ref<CodecId>(defaultCodecId);
const currentCodec = computed(() => codecSpecs.find((c) => c.id === codecId.value) ?? codecSpecs[0]);
const codecItems = codecSpecs.map(({ id, label }) => ({ value: id, label }));

const {
  original,
  encoded,
  conversionError,
  copyPending,
  clipboardError,
  copyText,
  updateOriginal,
  updateEncoded,
  pasteAndCopy,
  handleEncodedPaste,
  clear,
} = useCodecPair(computed(() => currentCodec.value.options));
</script>

<template>
  <ToolPage>
    <div class="flex flex-col gap-4">
      <RadioGroup v-model="codecId" :items="codecItems" label="编码方式" />
      <div class="flex flex-wrap gap-2">
        <Button variant="secondary" @click="pasteAndCopy">粘贴并自动检测</Button>
        <Button variant="outline" :disabled="!original && !encoded" @click="clear">清空所有</Button>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>{{ currentCodec.originalLabel }}</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <Textarea
            :model-value="original"
            class="min-h-64 resize-y"
            monospace
            :placeholder="currentCodec.originalPlaceholder"
            @update:model-value="updateOriginal"
          />
          <div class="flex gap-2">
            <Button
              variant="secondary"
              :disabled="!original || copyPending"
              @click="copyText(original)"
              >复制</Button
            >
            <Button variant="outline" @click="updateOriginal('')">清空</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{{ currentCodec.encodedLabel }}</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <Textarea
            :model-value="encoded"
            class="min-h-64 resize-y"
            monospace
            :placeholder="currentCodec.encodedPlaceholder"
            :aria-invalid="Boolean(conversionError)"
            @paste="handleEncodedPaste"
            @update:model-value="updateEncoded"
          />
          <div class="flex gap-2">
            <Button
              variant="secondary"
              :disabled="!encoded || copyPending"
              @click="copyText(encoded)"
              >复制</Button
            >
            <Button variant="outline" @click="updateEncoded('')">清空</Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <p v-if="clipboardError" role="status" aria-live="polite" class="text-sm text-destructive">
      {{ clipboardError }}
    </p>
  </ToolPage>
</template>
