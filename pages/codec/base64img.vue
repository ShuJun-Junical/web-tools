<template>
  <div>
    <h1 class="text-4xl font-bold mb-4">Base64图片</h1>
    <p class="text-md text">编解码工具</p>
    <p class="text-md text mt-8">一键编解码：粘贴-编解码-复制一键操作</p>
    <div class="flex my-4 space-x-2">
      <button
        class="btn btn-secondary"
        @click="
          async () => {
            await pasteFromClipboard('ori');
            copyToClipboard(b64);
          }
        "
      >
        原文编码
      </button>
      <button
        class="btn btn-secondary"
        @click="
          async () => {
            await pasteFromClipboard('b64');
            if (!b64Error) copyToClipboard(ori);
          }
        "
      >
        Base64解码
      </button>
      <button
        class="btn btn-primary"
        @click="
          ori = '';
          b64 = '';
          b64Error = false;
        "
      >
        清空所有
      </button>
    </div>
    <div class="grid grid-cols-3 gap-4 mt-8 md:max-w-lg">
      <!-- TODO textarea自适应高度，会随着用户输入增高，但有最大高度限制 -->
      <textarea
        class="textarea textarea-bordered"
        :placeholder="b64Error ? '不是合法的Base64字符串' : '原文（UTF-8)'"
        v-model="ori"
        style="height: auto; max-height: 300px; overflow-y: auto"
      ></textarea>
    </div>
    <div class="flex mt-4 space-x-2">
      <button class="btn btn-secondary" @click="ori && copyToClipboard(ori)">
        复制
      </button>
      <button class="btn btn-secondary" @click="pasteFromClipboard('ori')">
        粘贴
      </button>
      <button class="btn btn-primary" @click="ori = ''">清空</button>
    </div>
    <div class="grid grid-cols-3 gap-4 mt-8 md:max-w-lg">
      <!-- TODO textarea自适应高度，会随着用户输入增高，但有最大高度限制 -->
      <textarea
        class="textarea textarea-bordered"
        :class="{ 'textarea-error': b64Error }"
        placeholder="Base64"
        v-model="b64"
        style="height: auto; max-height: 300px; overflow-y: auto"
      ></textarea>
    </div>
    <div class="flex mt-4 space-x-2">
      <button class="btn btn-secondary" @click="b64 && copyToClipboard(b64)">
        复制
      </button>
      <button class="btn btn-secondary" @click="pasteFromClipboard('b64')">
        粘贴
      </button>
      <button
        class="btn btn-primary"
        @click="
          b64 = '';
          b64Error = false;
        "
      >
        清空
      </button>
    </div>
  </div>
</template>

<script setup>
const ori = ref('');
const b64 = ref('');

const b64Error = ref(false);

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    console.error('Failed to copy text to clipboard: ', e);
  }
}

async function pasteFromClipboard(refName) {
  try {
    const text = await navigator.clipboard.readText();
    if (refName === 'ori') {
      ori.value = text;
    } else if (refName === 'b64') {
      b64.value = text;
    }
  } catch (e) {
    console.error('Failed to read clipboard contents: ', e);
  }
}

function utf8_to_b64(str) {
  return window.btoa(unescape(encodeURIComponent(str)));
}

function b64_to_utf8(str) {
  try {
    b64Error.value = false;
    return decodeURIComponent(escape(window.atob(str)));
  } catch (e) {
    b64Error.value = true;
    return '';
  }
}

watch(ori, () => {
  b64.value = utf8_to_b64(ori.value);
});

watch(b64, () => {
  ori.value = b64_to_utf8(b64.value);
});
</script>
