<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="`toast-${t.type}`"
      >
        <div class="toast-icon">
          <AppIcon :name="iconMap[t.type]" :size="16" />
        </div>
        <div class="toast-content">
          <div v-if="t.title" class="toast-title">{{ t.title }}</div>
          <div class="toast-msg">{{ t.message }}</div>
        </div>
        <button class="toast-close" @click="remove(t.id)">
          <AppIcon name="close" :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import AppIcon from './AppIcon.vue'

const toasts = ref([])
let counter = 0

const iconMap = {
  success: 'check-circle',
  error: 'x-circle',
  warning: 'alert-triangle',
  info: 'info',
}

function add({ type = 'info', title = '', message = '', duration = 3500 }) {
  const id = ++counter
  toasts.value.push({ id, type, title, message })
  setTimeout(() => remove(id), duration)
}

function remove(id) {
  const idx = toasts.value.findIndex(t => t.id === id)
  if (idx !== -1) toasts.value.splice(idx, 1)
}

defineExpose({ add })
</script>

<style scoped>
.toast-container {
  position: fixed; bottom: 24px; right: 24px;
  z-index: 9999;
  display: flex; flex-direction: column; gap: 10px;
  pointer-events: none;
}
.toast {
  background: var(--surface);
  backdrop-filter: blur(16px);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius);
  padding: 14px 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  min-width: 300px; max-width: 400px;
  display: flex; align-items: flex-start; gap: 12px;
  pointer-events: all;
  cursor: default;
}
.toast-success { border-left: 3px solid var(--success); }
.toast-error   { border-left: 3px solid var(--danger); }
.toast-warning { border-left: 3px solid var(--warning); }
.toast-info    { border-left: 3px solid var(--primary); }

.toast-icon { flex-shrink: 0; margin-top: 1px; }
.toast-success .toast-icon { color: var(--success); }
.toast-error   .toast-icon { color: var(--danger); }
.toast-warning .toast-icon { color: var(--warning); }
.toast-info    .toast-icon { color: var(--primary); }

.toast-content { flex: 1; }
.toast-title { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
.toast-msg   { font-size: 13px; color: var(--text-secondary); }

.toast-close {
  background: transparent; border: none; cursor: pointer;
  color: var(--text-muted); padding: 2px; border-radius: 4px;
  display: flex; align-items: center;
  transition: color var(--transition);
}
.toast-close:hover { color: var(--text); }

.toast-enter-active { transition: all 0.35s cubic-bezier(0.34,1.56,0.64,1); }
.toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from { opacity: 0; transform: translateX(60px); }
.toast-leave-to   { opacity: 0; transform: translateX(60px); }
</style>
