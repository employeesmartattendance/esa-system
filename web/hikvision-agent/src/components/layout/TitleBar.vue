<template>
  <div class="titlebar">
    <div class="titlebar-drag">
      <span class="titlebar-title">ESA Hikvision Agent</span>
    </div>
    <div class="titlebar-controls">
      <button class="titlebar-btn" @click="minimize" title="Minimize">
        <span class="icon icon-sm" v-html="icons.minimize"></span>
      </button>
      <button class="titlebar-btn" @click="maximize" title="Maximize">
        <span class="icon icon-sm" v-html="isMaximized ? icons.maximize : icons.maximize"></span>
      </button>
      <button class="titlebar-btn titlebar-btn-close" @click="close" title="Close">
        <span class="icon icon-sm" v-html="icons.close"></span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import icons from '../../icons/index.js';

const isMaximized = ref(false);

function minimize() {
  window.agentAPI?.window?.minimize();
}
function maximize() {
  window.agentAPI?.window?.maximize();
  window.agentAPI?.window?.isMaximized().then(v => { isMaximized.value = v; });
}
function close() {
  window.agentAPI?.window?.close();
}

onMounted(() => {
  window.agentAPI?.window?.isMaximized().then(v => { isMaximized.value = v; });
});
</script>

<style scoped>
.titlebar {
  height: var(--titlebar-height);
  background: var(--color-titlebar-bg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
  -webkit-app-region: drag;
  flex-shrink: 0;
}
.titlebar-drag {
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 14px;
}
.titlebar-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
  letter-spacing: 0.3px;
}
.titlebar-controls {
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag;
}
.titlebar-btn {
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.6);
  transition: background var(--transition-fast);
}
.titlebar-btn:hover {
  background: rgba(255,255,255,0.1);
  color: white;
}
.titlebar-btn-close:hover {
  background: #e81123;
  color: white;
}
</style>