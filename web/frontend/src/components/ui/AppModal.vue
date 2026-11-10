<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="$emit('update:modelValue', false)">
        <div
          ref="modalBoxRef"
          class="modal-box"
          :style="maxWidth ? `max-width:${maxWidth}` : ''"
          @click.stop
        >
          <div class="modal-sheet-handle-wrap" @pointerdown="onHandlePointerDown" @pointermove="onHandlePointerMove" @pointerup="onHandlePointerUp" @pointercancel="onHandlePointerCancel">
            <span class="modal-sheet-handle" aria-hidden="true"></span>
          </div>
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
    </Transition>
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
const emit = defineEmits(['update:modelValue'])

useScrollLock(toRef(props, 'modelValue'))

const modalBoxRef = ref(null)
const dragState = { active: false, startY: 0, lastY: 0, startedAt: 0, offset: 0 }
function onHandlePointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const box = modalBoxRef.value
  if (!box) return
  dragState.active = true
  dragState.startY = event.clientY
  dragState.lastY = event.clientY
  dragState.startedAt = performance.now()
  dragState.offset = 0
  box.style.transition = 'none'
  event.currentTarget.setPointerCapture?.(event.pointerId)
}
function onHandlePointerMove(event) {
  if (!dragState.active) return
  const delta = Math.max(0, event.clientY - dragState.startY)
  dragState.lastY = event.clientY
  dragState.offset = delta
  if (modalBoxRef.value) modalBoxRef.value.style.transform = `translate3d(0, ${delta}px, 0)`
}
function onHandlePointerCancel() {
  if (!dragState.active) return
  dragState.active = false
  dragState.offset = 0
  const box = modalBoxRef.value
  if (box) {
    box.style.transition = 'transform .18s ease-out'
    box.style.transform = 'translate3d(0, 0, 0)'
    window.setTimeout(() => {
      if (modalBoxRef.value === box) {
        box.style.transform = ''
        box.style.transition = ''
      }
    }, 190)
  }
}

function onHandlePointerUp(event) {
  if (!dragState.active) return
  dragState.active = false
  const elapsed = Math.max(1, performance.now() - dragState.startedAt)
  const velocity = (dragState.lastY - dragState.startY) / elapsed
  const shouldClose = dragState.offset > 112 || (dragState.offset > 34 && velocity > 0.65)
  const box = modalBoxRef.value
  if (box) {
    box.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)'
    box.style.transform = shouldClose ? `translate3d(0, 110%, 0)` : 'translate3d(0, 0, 0)'
  }
  if (shouldClose) window.setTimeout(() => emit('update:modelValue', false), 220)
  dragState.offset = 0
}

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
}
.modal-sheet-handle-wrap { display:none; }
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

/* ── Fade Effect ──────────────────────────────────────────────────────────
   High-performance fade in/out. Only `opacity` is animated (a compositor-
   only property), so open/close stays smooth even on low-end devices —
   unlike the previous genie/scale effect, which animated transform +
   border-radius via a JS-computed per-open origin and caused jank/freezes
   on repeated opens. */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.15s ease;
}
.modal-fade-enter-active .modal-box,
.modal-fade-leave-active .modal-box {
  transition: opacity 0.15s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-from .modal-box,
.modal-fade-leave-to .modal-box {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .modal-fade-enter-active,
  .modal-fade-leave-active,
  .modal-fade-enter-active .modal-box,
  .modal-fade-leave-active .modal-box {
    transition: none;
  }
}

/* Mobile: keep the modal from ever stretching toward full viewport height —
   give it a flexible, shorter max-height so short-content modals stay
   compact instead of growing tall, matching the page-level dashboard
   scroll behavior. The scrollbar on .modal-body auto-hides here the same
   way .layout-content's does, fading in only while actively scrolling. */
@media (max-width: 768px) {
  .modal-overlay { padding: 0; align-items: flex-end !important; justify-content: center !important; }
  .modal-box { max-height: min(91dvh, 860px); max-width: 680px; border-radius: 24px 24px 0 0; border-left: 0; border-right: 0; border-bottom: 0; padding-bottom: env(safe-area-inset-bottom); transform: translate3d(0,0,0); will-change: transform; }
  .modal-fade-enter-active .modal-box { transition: transform .24s cubic-bezier(.2,.8,.2,1), opacity .15s ease; }
  .modal-fade-leave-active .modal-box { transition: transform .18s ease-in, opacity .15s ease; }
  .modal-fade-enter-from .modal-box,
  .modal-fade-leave-to .modal-box { transform: translate3d(0, 100%, 0); }
  .modal-sheet-handle-wrap { height: 26px; display:flex; align-items:center; justify-content:center; flex:0 0 26px; touch-action:none; cursor:grab; }
  .modal-sheet-handle-wrap:active { cursor:grabbing; }
  .modal-sheet-handle { display:block; width:38px; height:4px; border-radius:99px; background:var(--text-muted); opacity:.42; }
  .modal-header { padding: 8px 18px 14px; }
  .modal-body { padding: 16px 18px 20px; }
  .modal-footer { padding: 12px 18px 14px; }
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
