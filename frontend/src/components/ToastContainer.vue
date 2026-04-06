<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast-${t.type}`">
        <span class="toast-icon">{{ icons[t.type] }}</span>
        <span>{{ t.message }}</span>
        <button class="toast-close" @click="remove(t.id)">✕</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const toasts = ref([])
const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' }

function add(message, type = 'info', duration = 3500) {
  const id = Date.now()
  toasts.value.push({ id, message, type })
  setTimeout(() => remove(id), duration)
}
function remove(id) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

// Global toast access
window.$toast = { success: m => add(m,'success'), error: m => add(m,'error'), warning: m => add(m,'warning'), info: m => add(m,'info') }
</script>

<style scoped>
.toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; }
.toast {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius);
  padding: 14px 18px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  min-width: 280px; max-width: 380px;
  display: flex; align-items: center; gap: 12px;
  font-size: 14px; font-weight: 500;
}
.toast-success { border-left: 3px solid var(--success); }
.toast-error { border-left: 3px solid var(--danger); }
.toast-warning { border-left: 3px solid var(--warning); }
.toast-info { border-left: 3px solid var(--primary); }
.toast-close { margin-left: auto; background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 13px; padding: 2px 6px; }

.toast-enter-active { animation: slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1); }
.toast-leave-active { animation: slideUp 0.2s ease reverse; }
@keyframes slideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
</style>
