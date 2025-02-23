<template>
  <div class="drawer md:drawer-open pt-16 h-screen">
    <input id="my-drawer-3" type="checkbox" class="drawer-toggle" />
    <div class="drawer-content overflow-scroll pt-4">
      <slot></slot>
    </div>
    <div class="drawer-side h-full pt-4">
      <label
        for="my-drawer-3"
        aria-label="close sidebar"
        class="drawer-overlay"
      ></label>
      <ul class="menu bg-base-100 w-64">
        <li>
          <h2 class="menu-title">Title</h2>
          <ul>
            <li><a>Item 1</a></li>
            <li><a>Item 2</a></li>
            <li><a>Item 3</a></li>
          </ul>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
const list = [
  {
    title: '统计学计算器',
    link: '/1/',
    child: [
      { title: '工具 1', link: '2' },
      { title: '工具 1', link: '2' },
    ],
  },
];
</script>
