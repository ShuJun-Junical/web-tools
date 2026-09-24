<script setup lang="ts">
import { computed, ref } from 'vue';
import katex from 'katex';
import ToolPage from '@/components/ToolPage.vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  chiSquare2x2,
  contingencyKeys,
  phiCoefficient2x2,
  solveContingencyTable,
  type ContingencyKey,
} from '@/lib/statistics';

const tableRows = [
  ['a', 'b', 'ab'],
  ['c', 'd', 'cd'],
  ['ac', 'bd', 'n'],
] as const;
const coreKeys = ['a', 'b', 'c', 'd'] as const;
const totalKeys: ContingencyKey[] = ['ab', 'cd', 'ac', 'bd'];
const labels: Record<ContingencyKey, string> = {
  a: 'a',
  b: 'b',
  c: 'c',
  d: 'd',
  ab: '第一行合计',
  cd: '第二行合计',
  ac: '第一列合计',
  bd: '第二列合计',
  n: '总计',
};

function emptyCells(): Record<ContingencyKey, string> {
  return Object.fromEntries(contingencyKeys.map((key) => [key, ''])) as Record<
    ContingencyKey,
    string
  >;
}

const cells = ref(emptyCells());
const inputVersions = ref(
  Object.fromEntries(contingencyKeys.map((key) => [key, 0])) as Record<ContingencyKey, number>
);
const hasInput = computed(() => contingencyKeys.some((key) => cells.value[key] !== ''));
const invalidKeys = computed(() =>
  contingencyKeys.filter((key) => {
    const raw = cells.value[key];
    const value = Number(raw);
    return raw !== '' && (!raw.trim() || !Number.isSafeInteger(value) || value < 0);
  })
);
const inputValues = computed(
  () =>
    Object.fromEntries(
      contingencyKeys.flatMap((key) => {
        const raw = cells.value[key];
        return raw === '' ? [] : [[key, Number(raw)]];
      })
    ) as Partial<Record<ContingencyKey, number>>
);
const solution = computed(() =>
  solveContingencyTable(invalidKeys.value.length ? {} : inputValues.value)
);
const unresolvedKeys = computed(() =>
  hasInput.value && !invalidKeys.value.length && !solution.value.conflictKeys.length
    ? coreKeys.filter((key) => solution.value.values[key] === null)
    : []
);
const counts = computed(() => {
  const values = coreKeys.map((key) => solution.value.values[key]);
  return values.includes(null) ? null : (values as [number, number, number, number]);
});
const result = computed(() =>
  invalidKeys.value.length || solution.value.conflictKeys.length || !counts.value
    ? null
    : chiSquare2x2(counts.value)
);
const association = computed(() =>
  result.value === null || !counts.value ? null : phiCoefficient2x2(counts.value)
);
const hasZeroTotal = computed(() =>
  Boolean(
    counts.value &&
    !invalidKeys.value.length &&
    !solution.value.conflictKeys.length &&
    result.value === null
  )
);
const formula = computed(() => {
  const base = 'K^2=\\frac{n(ad-bc)^2}{(a+b)(c+d)(a+c)(b+d)}';
  if (result.value === null || !counts.value)
    return katex.renderToString(base, { displayMode: true });

  const [a, b, c, d] = counts.value;
  const { ab, cd, ac, bd, n } = solution.value.values;
  const rounded = Math.round(result.value * 10000) / 10000;
  return katex.renderToString(
    `${base}=\\frac{${n}\\times(${a}\\times${d}-${b}\\times${c})^2}` +
      `{${ab}\\times${cd}\\times${ac}\\times${bd}}` +
      `${result.value === rounded ? '=' : '\\approx'}${rounded}`,
    { displayMode: true }
  );
});
const associationFormula = computed(() => {
  if (association.value === null || result.value === null) return '';

  const chiSquare = Math.round(result.value * 10000) / 10000;
  return katex.renderToString(
    `\\phi=\\sqrt{\\frac{K^2}{n}}=\\sqrt{\\frac{${chiSquare}}{${solution.value.values.n}}}\\approx${association.value.toFixed(4)}`,
    { displayMode: true }
  );
});

function displayValue(key: ContingencyKey) {
  return cells.value[key] !== '' ? cells.value[key] : (solution.value.values[key] ?? '');
}

function setCell(key: ContingencyKey, value: string | number) {
  cells.value[key] = String(value);
  if (value === '') inputVersions.value[key]++;
}

function isInvalid(key: ContingencyKey) {
  return (
    invalidKeys.value.includes(key) ||
    solution.value.conflictKeys.includes(key) ||
    (hasZeroTotal.value && totalKeys.includes(key) && solution.value.values[key] === 0)
  );
}

function clear() {
  cells.value = emptyCells();
}
</script>

<template>
  <ToolPage>
    <Card>
      <CardHeader><CardTitle>列联表</CardTitle></CardHeader>
      <CardContent>
        <form class="space-y-5" @reset="clear">
          <div class="grid grid-cols-3 gap-3">
            <template v-for="(row, rowIndex) in tableRows" :key="rowIndex">
              <label v-for="key in row" :key="key" :for="`cell-${key}`" class="space-y-1">
                <span class="text-sm font-medium">{{ labels[key] }}</span>
                <Input
                  :key="inputVersions[key]"
                  :id="`cell-${key}`"
                  :model-value="displayValue(key)"
                  type="number"
                  min="0"
                  step="1"
                  autocomplete="off"
                  :aria-invalid="isInvalid(key)"
                  :class="[
                    cells[key] === '' &&
                      solution.derivedKeys.includes(key) &&
                      'bg-muted/60 text-muted-foreground',
                    hasZeroTotal &&
                      totalKeys.includes(key) &&
                      solution.values[key] === 0 &&
                      'bg-destructive/10',
                  ]"
                  @update:model-value="(value) => setCell(key, value)"
                />
              </label>
            </template>
          </div>
          <p v-if="solution.derivedKeys.length" class="text-sm text-muted-foreground">
            浅色数值由已输入的分项和合计自动计算，可直接修改。
          </p>
          <div class="min-h-5 text-sm">
            <p v-if="invalidKeys.length" role="alert" class="text-destructive">
              {{ invalidKeys.map((key) => labels[key]).join('、') }} 必须是非负整数。
            </p>
            <p v-else-if="solution.negativeKeys.length" role="alert" class="text-destructive">
              合计不能小于已输入的组成项。
            </p>
            <p v-else-if="solution.conflictKeys.length" role="alert" class="text-destructive">
              {{ solution.conflictKeys.map((key) => labels[key]).join('、') }} 的数值与合计不一致。
            </p>
            <p v-else-if="unresolvedKeys.length" role="status" class="text-muted-foreground">
              信息不足，尚不能确定 {{ unresolvedKeys.join('、') }}。
            </p>
            <p v-else-if="hasZeroTotal" role="alert" class="text-destructive">
              行合计或列合计为零，无法计算卡方统计量。
            </p>
          </div>
          <Button type="reset" variant="outline">清空</Button>
        </form>
      </CardContent>
    </Card>

    <Card aria-live="polite">
      <CardHeader><CardTitle>计算结果</CardTitle></CardHeader>
      <CardContent class="space-y-5">
        <div class="overflow-x-auto py-2 [&_.katex-html]:text-left" v-html="formula" />
        <div v-if="association !== null" class="space-y-2 border-t pt-5">
          <p class="text-sm font-medium">关联强度（Phi 系数）</p>
          <p class="text-3xl font-semibold">{{ (association * 100).toFixed(2) }}%</p>
          <div class="overflow-x-auto py-1 [&_.katex-html]:text-left" v-html="associationFormula" />
          <p class="text-sm text-muted-foreground">
            该百分比是 Phi 系数的百分比表达，统计显著性需另行判断。
          </p>
        </div>
      </CardContent>
    </Card>
  </ToolPage>
</template>
