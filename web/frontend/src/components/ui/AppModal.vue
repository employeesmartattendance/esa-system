<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="$emit('update:modelValue', false)">
      <div
        class="modal-box"
        :style="maxWidth ? `max-width:${maxWidth}` : ''"
        @click.stop
      >
        <div class="modal-header">
          <div class="modal-header-left">
            <div v-if="icon" class="modal-icon-wrap">
              <AppIcon :name="icon" :size="20" :color="iconColor || 'var(--primary)'" />
            </div>
            <div>
              <h3 class="modal-title">{{ title }}</h3>
              <p v-if="subtitle" class="modal-subtitle">{{ subtitle }}</p>
            </div>
          </div>
          <button class="modal-close" @click="$emit('update:modelValue', false)">
            <AppIcon name="close" :size="18" />
          </button>
        </div>
        <div class="modal-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="modal-footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import AppIcon from './AppIcon.vue'
defineProps({
  modelValue: Boolean,
  title: String,
  subtitle: String,
  icon: String,
  iconColor: String,
  maxWidth: String,
})
defineEmits(['update:modelValue'])
</script>

<style>
/* Global styles so they apply even with v-if re-renders */
.modal-overlay {
  position: fixed !important;
  inset: 0 !important;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 9999 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 20px;
  animation: modalFadeIn 0.2s ease;
}
.modal-box {
  background: var(--bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  width: 100%;
  max-width: 540px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
  animation: modalSlideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 22px 24px 18px;
  border-bottom: 1px solid var(--surface-border);
  gap: 12px;
}
.modal-header-left { display: flex; align-items: center; gap: 12px; }
.modal-icon-wrap {
  width: 42px; height: 42px;
  border-radius: var(--radius);
  background: rgba(37, 99, 235, 0.1);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.modal-title    { font-size: 17px; font-weight: 700; }
.modal-subtitle { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
.modal-close {
  width: 32px; height: 32px;
  border-radius: 50%;
  border: 1px solid var(--surface-border);
  background: var(--surface);
  color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
}
.modal-close:hover { background: var(--danger); color: #fff; border-color: var(--danger); }
.modal-body   { padding: 20px 24px 24px; }
.modal-footer {
  padding: 14px 24px 20px;
  display: flex; justify-content: flex-end; gap: 10px;
  border-top: 1px solid var(--surface-border);
}
@keyframes modalFadeIn   { from { opacity: 0 } to { opacity: 1 } }
@keyframes modalSlideUp  { from { transform: translateY(20px) scale(0.96); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }
</style>
