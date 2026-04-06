<template>
  <div class="esa-titlebar" :class="{ 'titlebar-maximized': isMaximized }">

    <!-- ── Drag region (fills whole bar, buttons sit on top as no-drag) ── -->
    <div class="titlebar-drag-region">

      <!-- Left: branding -->
      <div class="titlebar-brand">
        <div class="titlebar-logo-wrap">
          <img src="/esa-logo.png" alt="ESA" class="titlebar-logo" />
        </div>
        <div class="titlebar-app-name">
          <span class="titlebar-name">ESA</span>
          <span class="titlebar-subtitle">Smart Attendance</span>
        </div>
        <div class="titlebar-divider"></div>
        <div class="titlebar-version">Desktop</div>
      </div>

      <!-- Center: live status pill -->
      <div class="titlebar-center">
        <div class="titlebar-live-pill">
          <span class="titlebar-live-dot"></span>
          <span>LIVE</span>
        </div>
      </div>

    </div>

    <!-- Right: window control buttons (no-drag) -->
    <div class="titlebar-controls">

      <!-- Minimize -->
      <button
        class="tb-btn tb-minimize"
        @click="minimize"
        title="Minimize"
        aria-label="Minimize window"
      >
        <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
          <rect width="10" height="1" rx="0.5" fill="currentColor"/>
        </svg>
      </button>

      <!-- Maximize / Restore -->
      <button
        class="tb-btn tb-maximize"
        @click="toggleMaximize"
        :title="isMaximized ? 'Restore' : 'Maximize'"
        :aria-label="isMaximized ? 'Restore window' : 'Maximize window'"
      >
        <!-- Restore icon (two overlapping squares) -->
        <svg v-if="isMaximized" width="10" height="10" viewBox="0 0 10 10" fill="none">
          <rect x="2.5" y="0" width="7.5" height="7.5" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/>
          <rect x="0" y="2.5" width="7.5" height="7.5" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/>
        </svg>
        <!-- Maximize icon (single square) -->
        <svg v-else width="10" height="10" viewBox="0 0 10 10" fill="none">
          <rect x="0.6" y="0.6" width="8.8" height="8.8" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/>
        </svg>
      </button>

      <!-- Close -->
      <button
        class="tb-btn tb-close"
        @click="close"
        title="Close"
        aria-label="Close window"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isMaximized = ref(false)
let removeMaxListener = null

function minimize() {
  window.electronAPI?.windowMinimize()
}

async function toggleMaximize() {
  window.electronAPI?.windowMaximize()
}

function close() {
  window.electronAPI?.windowClose()
}

onMounted(async () => {
  // Sync initial maximize state
  if (window.electronAPI?.isWindowMaximized) {
    isMaximized.value = await window.electronAPI.isWindowMaximized()
  }
  // Listen for maximize/unmaximize events from main process
  if (window.electronAPI?.onMaximizedState) {
    removeMaxListener = window.electronAPI.onMaximizedState((isMax) => {
      isMaximized.value = isMax
    })
  }
})

onUnmounted(() => {
  if (removeMaxListener) removeMaxListener()
})
</script>

<style scoped>
/* ── Title bar root ─────────────────────────────────────────────────────── */
.esa-titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  height: 40px;
  display: flex;
  align-items: stretch;

  /* ESA glassmorphism — matches the app's dark sidebar/topbar style */
  background: var(--sidebar-bg, rgba(7, 14, 38, 0.97));
  border-bottom: 1px solid var(--surface-border, rgba(59, 130, 246, 0.16));
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);

  /* Subtle gradient accent on top edge */
  box-shadow:
    0 1px 0 0 rgba(37, 99, 235, 0.3),
    0 2px 16px rgba(0, 0, 0, 0.4);

  user-select: none;
  -webkit-user-select: none;
}

/* ── Drag region fills everything except the controls ───────────────────── */
.titlebar-drag-region {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 12px;
  -webkit-app-region: drag;  /* ← makes this area draggable */
  app-region: drag;
  min-width: 0;
}

/* ── Branding ───────────────────────────────────────────────────────────── */
.titlebar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.titlebar-logo-wrap {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(37, 99, 235, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.titlebar-logo {
  width: 20px;
  height: 20px;
  object-fit: contain;
  border-radius: 4px;
}

.titlebar-app-name {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.titlebar-name {
  font-size: 12px;
  font-weight: 800;
  color: var(--text, #e2e8f0);
  letter-spacing: 0.04em;
  font-family: var(--font, 'Outfit', sans-serif);
}

.titlebar-subtitle {
  font-size: 9px;
  font-weight: 500;
  color: var(--text-muted, #475569);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-family: var(--font, 'Outfit', sans-serif);
}

.titlebar-divider {
  width: 1px;
  height: 14px;
  background: var(--surface-border, rgba(59, 130, 246, 0.16));
  flex-shrink: 0;
}

.titlebar-version {
  font-size: 10px;
  font-weight: 600;
  color: var(--primary, #2563eb);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-family: var(--font, 'Outfit', sans-serif);
  background: rgba(37, 99, 235, 0.1);
  border: 1px solid rgba(37, 99, 235, 0.2);
  border-radius: 99px;
  padding: 1px 7px;
}

/* ── Center live pill ───────────────────────────────────────────────────── */
.titlebar-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.titlebar-live-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 99px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--success, #10b981);
  font-family: var(--font, 'Outfit', sans-serif);
  text-transform: uppercase;
}

.titlebar-live-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--success, #10b981);
  animation: titlebar-pulse 1.5s ease-in-out infinite;
}

/* ── Window control buttons ─────────────────────────────────────────────── */
.titlebar-controls {
  display: flex;
  align-items: stretch;
  -webkit-app-region: no-drag;  /* ← buttons must NOT be draggable */
  app-region: no-drag;
  flex-shrink: 0;
}

.tb-btn {
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  color: var(--text-muted, #475569);
  -webkit-app-region: no-drag;
  app-region: no-drag;
  outline: none;
  flex-shrink: 0;
}

/* Minimize — accent blue hover */
.tb-minimize:hover {
  background: rgba(37, 99, 235, 0.18);
  color: var(--primary, #2563eb);
}

/* Maximize — green hover */
.tb-maximize:hover {
  background: rgba(16, 185, 129, 0.18);
  color: var(--success, #10b981);
}

/* Close — red hover (stronger, matches OS expectation) */
.tb-close:hover {
  background: rgba(239, 68, 68, 0.22);
  color: #ef4444;
}

.tb-close:active {
  background: rgba(239, 68, 68, 0.36);
}

/* Slight press feedback */
.tb-btn:active {
  transform: scale(0.92);
}

/* Maximized state: restore icon is slightly different shade */
.titlebar-maximized .tb-maximize {
  color: var(--text-muted, #475569);
}

/* ── Animation ──────────────────────────────────────────────────────────── */
@keyframes titlebar-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.55; transform: scale(0.8); }
}
</style>
