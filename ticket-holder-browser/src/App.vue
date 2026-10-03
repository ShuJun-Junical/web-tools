<script setup lang="ts">
import FileUploader from './components/FileUploader.vue'
</script>

<template>
  <div class="app">
    <FileUploader />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

#app {
  min-height: 100vh;
  padding: 2rem 1rem;
}

.app {
  max-width: 100%;
}
</style>
