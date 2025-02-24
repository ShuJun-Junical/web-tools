<template>
  <div>
    <h1 class="text-4xl font-bold mb-4">URL Codec</h1>
    <p class="text-md text">编解码工具</p>
    <p class="text-md text mt-8">一键编解码：粘贴-编解码-复制一键操作</p>
    <div class="flex my-4 space-x-2">
      <button
        class="btn btn-secondary"
        @click="
          async () => {
            await pasteFromClipboard('ori');
            copyToClipboard(url);
          }
        "
      >
        URLEncode编码
      </button>
      <button
        class="btn btn-secondary"
        @click="
          async () => {
            await pasteFromClipboard('url');
            if (!URLError) copyToClipboard(ori);
          }
        "
      >
        URLDecode解码
      </button>
      <button
        class="btn btn-primary"
        @click="
          ori = '';
          url = '';
          URLError = false;
        "
      >
        清空所有
      </button>
    </div>
    <div class="grid grid-cols-3 gap-4 mt-8 md:max-w-lg">
      <!-- TODO textarea自适应高度，会随着用户输入增高，但有最大高度限制 -->
      <textarea
        class="textarea textarea-bordered"
        :placeholder="URLError ? '不是合法的Base64字符串' : '原文（UTF-8)'"
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
        :class="{ 'textarea-error': URLError }"
        placeholder="URLEncoded"
        v-model="url"
        style="height: auto; max-height: 300px; overflow-y: auto"
      ></textarea>
    </div>
    <div class="flex mt-4 space-x-2">
      <button class="btn btn-secondary" @click="url && copyToClipboard(url)">
        复制
      </button>
      <button class="btn btn-secondary" @click="pasteFromClipboard('url')">
        粘贴
      </button>
      <button
        class="btn btn-primary"
        @click="
          url = '';
          URLError = false;
        "
      >
        清空
      </button>
    </div>
  </div>
</template>

<script setup>
const ori = ref('');
const url = ref('');

const URLError = ref(false);

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
    } else if (refName === 'url') {
      url.value = text;
    }
  } catch (e) {
    console.error('Failed to read clipboard contents: ', e);
  }
}

function encodeURL(str) {
  return encodeURIComponent(str);
}

function decodeURL(str) {
  try {
    URLError.value = false;
    return decodeURIComponent(str);
  } catch (e) {
    URLError.value = true;
    return '';
  }
}

watch(ori, () => {
  url.value = encodeURL(ori.value);
});

watch(url, () => {
  ori.value = decodeURL(url.value);
});
</script>
