<template>
  <div>
    <h1 class="text-4xl font-bold mb-4">列联表和独立性检验</h1>
    <p class="text-md text">统计学计算器</p>
    <div class="grid grid-cols-3 gap-4 mt-8 md:max-w-lg">
      <label class="input input-bordered flex items-center gap-2">
        a&nbsp;=
        <input
          type="number"
          class="grow"
          placeholder="0"
          v-model.number="data1.a"
        />
      </label>
      <label class="input input-bordered flex items-center gap-2">
        b&nbsp;=
        <input
          type="number"
          class="grow"
          placeholder="0"
          v-model.number="data1.b"
        />
      </label>
      <label class="input input-bordered flex items-center gap-2" disabled>
        a+b&nbsp;=
        <input
          type="number"
          class="grow"
          placeholder="0"
          disabled
          :value="data1.a + data1.b"
        />
      </label>

      <label class="input input-bordered flex items-center gap-2">
        c&nbsp;=
        <input
          type="number"
          class="grow"
          placeholder="0"
          v-model.number="data1.c"
        />
      </label>
      <label class="input input-bordered flex items-center gap-2">
        d&nbsp;=
        <input
          type="number"
          class="grow"
          placeholder="0"
          v-model.number="data1.d"
        />
      </label>
      <label class="input input-bordered flex items-center gap-2" disabled>
        c+d&nbsp;=
        <input
          type="number"
          class="grow"
          placeholder="0"
          disabled
          :value="data1.c + data1.d"
        />
      </label>

      <label class="input input-bordered flex items-center gap-2" disabled>
        a+c&nbsp;=
        <input
          type="number"
          class="grow"
          placeholder="0"
          disabled
          :value="data1.a + data1.c"
        />
      </label>
      <label class="input input-bordered flex items-center gap-2" disabled>
        b+d&nbsp;=
        <input
          type="number"
          class="grow"
          placeholder="0"
          disabled
          :value="data1.d + data1.b"
        />
      </label>
      <label class="input input-bordered flex items-center gap-2" disabled>
        n&nbsp;=
        <input
          type="number"
          class="grow"
          placeholder="0"
          disabled
          :value="data1.a + data1.b + data1.c + data1.d"
        />
      </label>
    </div>
    <button
      class="btn btn-primary mt-4"
      @click="
        data1.a = '';
        data1.b = '';
        data1.c = '';
        data1.d = '';
      "
    >
      清空
    </button>
    <div v-html="k2" class="mt-4"></div>
  </div>
</template>

<script setup lang="ts">
import katex from 'katex';
import 'katex/dist/katex.min.css';

const data1 = ref({
  a: '',
  b: '',
  c: '',
  d: '',
});

// TODO: ab、cd、ac、bd、n也可以让用户输入

const k2 = computed(() => {
  let a = Number(data1.value.a) || 0;
  let b = Number(data1.value.b) || 0;
  let c = Number(data1.value.c) || 0;
  let d = Number(data1.value.d) || 0;
  let n = a + b + c + d;
  let raw =
    (n * (a * d - b * c) ** 2) / ((a + b) * (c + d) * (a + c) * (b + d));
  if (!Number.isFinite(raw))
    return katex.renderToString(
      'K^2=\\frac{n(a d-b c)^2}{(a+b)(c+d)(a+c)(b+d)}'
    );
  let res = Math.round(raw * 10000) / 10000;
  return katex.renderToString(
    `K^2=\\frac{n(a d-b c)^2}{(a+b)(c+d)(a+c)(b+d)}=
    \\frac{${n}\\times(${a}\\times${d}-${b}\\times${c})^2}
    {${a + b}\\times${c + d}\\times${a + c}\\times${b + d}}${
      raw == res ? '=' : '\\approx'
    }${res}`
  );
});
</script>
