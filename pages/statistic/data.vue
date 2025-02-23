<template>
  <div>
    <h1 class="text-4xl font-bold mb-4">统计计算</h1>
    <p class="text-md text">统计学计算器</p>
    <div class="grid grid-cols-3 gap-4 mt-8 md:max-w-lg">
      <!-- TODO textarea自适应高度，会随着用户输入增高，但有最大高度限制 -->
      <textarea
        class="textarea textarea-bordered"
        placeholder="输入数字，一行一个"
        v-model="text"
        style="height: auto; max-height: 300px; overflow-y: auto"
      ></textarea>
    </div>
    <button class="btn btn-primary mt-4" @click="text = ''">清空</button>
    <div class="mt-4">
      <ul>
        <li>数量: {{ values.count }}</li>
        <li>总和: {{ values.sum }}</li>
        <li>平均值: {{ values.mean }}</li>
        <li>方差: {{ values.variance }}</li>
        <li>标准差: {{ values.stdDev }}</li>
        <li>最小值: {{ values.min }}</li>
        <li>最大值: {{ values.max }}</li>
        <li>中位数: {{ values.median }}</li>
        <li>众数: {{ values.mode }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
const text = ref('');

const datalist = computed(() => {
  return text.value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
    .map(line => Number(line))
    .filter(num => !isNaN(num));
});

const values = computed(() => {
  const n = datalist.value.length;
  const sum = datalist.value.reduce((acc, cur) => acc + cur, 0);
  const mean = n ? sum / n : '-';
  const variance = n
    ? datalist.value.reduce((acc, cur) => acc + (cur - mean) ** 2, 0) / n
    : '-';
  const stdDev = n ? Math.sqrt(variance) : '-';
  const sortedList = [...datalist.value].sort((a, b) => a - b);
  const min = n ? sortedList[0] : '-';
  const max = n ? sortedList[sortedList.length - 1] : '-';
  const median = n
    ? sortedList.length % 2 === 0
      ? (sortedList[sortedList.length / 2 - 1] +
          sortedList[sortedList.length / 2]) /
        2
      : sortedList[Math.floor(sortedList.length / 2)]
    : '-';
  const mode = n
    ? Object.entries(
        datalist.value.reduce((acc, num) => {
          acc[num] = (acc[num] || 0) + 1;
          return acc;
        }, {})
      ).reduce(
        (acc, [num, count]) => {
          if (count > acc.count) {
            return { num, count };
          }
          return acc;
        },
        { num: null, count: 0 }
      ).num
    : '-';

  return {
    count: n,
    sum: isNaN(sum) ? '-' : sum,
    mean: mean === '-' ? '-' : isNaN(mean) ? '-' : mean,
    variance: variance === '-' ? '-' : isNaN(variance) ? '-' : variance,
    stdDev: stdDev === '-' ? '-' : isNaN(stdDev) ? '-' : stdDev,
    min: min === '-' ? '-' : isNaN(min) ? '-' : min,
    max: max === '-' ? '-' : isNaN(max) ? '-' : max,
    median: median === '-' ? '-' : isNaN(median) ? '-' : median,
    mode: mode === '-' ? '-' : isNaN(mode) ? '-' : mode,
  };
});
</script>
