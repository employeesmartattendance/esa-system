<template>
  <div class="app-layout">
    <TitleBar />
    <div class="app-body">
      <Sidebar />
      <main class="app-content" role="main">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import TitleBar from './TitleBar.vue';
import Sidebar from './Sidebar.vue';
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.app-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
  background: var(--color-bg);
}
</style>