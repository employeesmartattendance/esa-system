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
        <div class="modal-body" ref="modalBodyRef" @scroll="onModalBodyScroll">
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
import { toRef, ref, onBeforeUnmount } from 'vue'
import { useScrollLock } from '../../composables/useScrollLock'

const props = defineProps({
  modelValue: Boolean,
  title: String,
  subtitle: String,
  icon: String,
  iconColor: String,
  maxWidth: String,
})
defineEmits(['update:modelValue'])

useScrollLock(toRef(props, 'modelValue'))

// ── Mobile scrollbar fade ────────────────────────────────────────────────
// Same pattern used for the dashboard's .layout-content: the modal body's
// scrollbar only appears while actively scrolling, then fades out shortly
// after — desktop keeps it always visible (see CSS, fade rules are scoped
// to the sub-768px media query).
const modalBodyRef = ref(null)
let scrollFadeTimer = null
function onModalBodyScroll() {
  const el = modalBodyRef.value
  if (!el) return
  el.classList.add('is-scrolling')
  clearTimeout(scrollFadeTimer)
  scrollFadeTimer = setTimeout(() => {
    el.classList.remove('is-scrolling')
  }, 900)
}
onBeforeUnmount(() => clearTimeout(scrollFadeTimer))
</script>

<style>
/* Global styles so they apply even with v-if re-renders */
.modal-overlay {
  position: fixed !important;
  inset: 0 !important;
  background: rgba(0, 0, 0, 0.72);
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
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
  flex-shrink: 0;
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
/* Scrolling lives here — not on .modal-box — so the header and footer stay
   fixed in place and the scrollbar only ever runs alongside the body
   content, never next to the title (which produced an extra scrollbar
   line spanning the whole modal height). */
.modal-body   { padding: 20px 24px 24px; overflow-y: auto; flex: 1 1 auto; min-height: 0; }
.modal-footer {
  padding: 14px 24px 20px;
  display: flex; justify-content: flex-end; gap: 10px;
  border-top: 1px solid var(--surface-border);
  flex-shrink: 0;
}
@keyframes modalFadeIn   { from { opacity: 0 } to { opacity: 1 } }
@keyframes modalSlideUp  { from { transform: translateY(20px) scale(0.96); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }

/* Mobile: keep the modal from ever stretching toward full viewport height —
   give it a flexible, shorter max-height so short-content modals stay
   compact instead of growing tall, matching the page-level dashboard
   scroll behavior. The scrollbar on .modal-body auto-hides here the same
   way .layout-content's does, fading in only while actively scrolling. */
@media (max-width: 768px) {
  .modal-overlay { padding: 16px; }
  .modal-box { max-height: min(80vh, 640px); }
  .modal-body::-webkit-scrollbar-thumb {
    background: transparent;
    transition: background-color 0.6s ease;
  }
  .modal-body.is-scrolling::-webkit-scrollbar-thumb {
    background: var(--primary);
    transition: background-color 0.15s ease;
  }
  .modal-body {
    scrollbar-color: transparent transparent;
    transition: scrollbar-color 0.6s ease;
  }
  .modal-body.is-scrolling {
    scrollbar-color: var(--primary) transparent;
    transition: scrollbar-color 0.15s ease;
  }
}
</style>
