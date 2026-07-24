<template>
  <div class="app-layout" @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
    <div class="bg-mesh"></div>

    <AppSidebar v-model="sidebarOpen" :navSections="navSections" />

    <div class="layout-main">
      <TopBar
        :title="pageTitle"
        :subtitle="pageSubtitle"
        :isDark="isDark"
        :userName="user?.name || ''"
        :userAvatar="user?.avatar || ''"
        :notifCount="0"
        @toggle-sidebar="sidebarOpen = !sidebarOpen"
        @toggle-theme="toggleDark"
        @notifications="showNotif = !showNotif"
        @open-profile="showProfile = true"
      />

      <main ref="layoutContentRef" class="layout-content" @scroll.passive="onContentScroll">
        <!-- Transition removed to fix freezing during navigation -->
        <slot />
      </main>
    </div>

    <ToastNotification ref="toastRef" />
    <NotificationsPanel v-model="showNotif" />
    <ProfileModal v-model="showProfile" :user="user" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, provide } from 'vue'
import AppSidebar         from './AppSidebar.vue'
import TopBar             from './TopBar.vue'
import ToastNotification  from '../ui/ToastNotification.vue'
import NotificationsPanel from '../ui/NotificationsPanel.vue'
import ProfileModal       from '../ui/ProfileModal.vue'
import { useAuthStore }   from '../../stores/auth'
import { useDark }        from '../../composables/useDark'

const props = defineProps({
  navSections:  { type: Array,  default: () => [] },
  pageTitle:    { type: String, default: 'Dashboard' },
  pageSubtitle: { type: String, default: '' },
})

const auth = useAuthStore()
const user = computed(() => auth.user)
const { isDark, toggleDark } = useDark()

const sidebarOpen = ref(window.innerWidth >= 768)
const isMobile    = ref(window.innerWidth < 768)
const toastRef    = ref(null)
const showNotif   = ref(false)
const showProfile = ref(false)
const layoutContentRef = ref(null)
let lastApiErrorAt = 0
let scrollFadeTimer = null

function checkMobile() {
  isMobile.value = window.innerWidth < 768
  if (!isMobile.value) sidebarOpen.value = true
}

function handleApiError(event) {
  const now = Date.now()
  if (now - lastApiErrorAt < 1500) return
  lastApiErrorAt = now
  const message = event?.detail?.message || 'Network request failed'
  toastRef.value?.add({ type: 'error', message })
}

// ── Mobile scrollbar fade ────────────────────────────────────────────────
// On mobile the right scrollbar should only be visible while actively
// scrolling, then fade out shortly after. Desktop keeps the scrollbar
// always visible (see CSS — the fade rules only apply below 768px).
function onContentScroll() {
  if (!isMobile.value) return
  const el = layoutContentRef.value
  if (!el) return
  el.classList.add('is-scrolling')
  clearTimeout(scrollFadeTimer)
  scrollFadeTimer = setTimeout(() => {
    el.classList.remove('is-scrolling')
  }, 900)
}

onMounted(() => {
  window.addEventListener('resize', checkMobile)
  window.addEventListener('esa:api-error', handleApiError)
  // Dashboard pages should only ever scroll inside .layout-content (below
  // the topbar). Locking the document here is a fallback for environments
  // where the CSS `:has()` rule in main.css isn't supported, so the native
  // scrollbar never ends up spanning the full page/behind the topbar.
  document.documentElement.classList.add('dashboard-active')
  document.body.classList.add('dashboard-active')
})
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('esa:api-error', handleApiError)
  document.documentElement.classList.remove('dashboard-active')
  document.body.classList.remove('dashboard-active')
  clearTimeout(scrollFadeTimer)
})

// ── Swipe gesture to open/close sidebar ──────────────────────────────────
let touchStartX = 0
let touchStartY = 0
let touchStartInMap = false

// Elements matching this selector own their own horizontal drag gestures
// (map pan/zoom, etc.) — swipes starting inside them shouldn't also try
// to open/close the sidebar.
const SWIPE_EXCLUDE_SELECTOR = '.map-wrapper, .mobile-map-component, .maplibregl-map'

function onTouchStart(e) {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
  touchStartInMap = !!e.target.closest?.(SWIPE_EXCLUDE_SELECTOR)
}

function onTouchEnd(e) {
  if (!isMobile.value || touchStartInMap) return
  const dx = e.changedTouches[0].clientX - touchStartX
  const dy = e.changedTouches[0].clientY - touchStartY
  // Only trigger if horizontal swipe is dominant (avoid scroll conflicts)
  if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return
  if (dx > 0 && !sidebarOpen.value && touchStartX < window.innerWidth * 0.70) {
    // Swipe right from 70% of screen left → open sidebar
    sidebarOpen.value = true
  } else if (dx < 0 && sidebarOpen.value) {
    // Swipe left → close sidebar
    sidebarOpen.value = false
  }
}

// Provide toast globally to all child components via inject
provide('toast', {
  success: (msg, title) => toastRef.value?.add({ type: 'success', message: msg, title }),
  error:   (msg, title) => toastRef.value?.add({ type: 'error',   message: msg, title }),
  info:    (msg, title) => toastRef.value?.add({ type: 'info',    message: msg, title }),
  warning: (msg, title) => toastRef.value?.add({ type: 'warning', message: msg, title }),
})
</script>

<style scoped>
.app-layout {
  display: flex; height: 100vh; height: 100dvh; max-height: 100%;
  background: var(--bg); position: relative;
  overflow: hidden; max-width: 100vw;
}
.layout-main {
  flex: 1; margin-left: 264px; height: 100vh; height: 100dvh;
  display: flex; flex-direction: column;
  transition: margin-left var(--transition);
  position: relative; z-index: 1;
  min-height: 0; max-width: 100%; min-width: 0;
}
.layout-content { flex: 1; padding: 28px; padding-right: 28px; box-sizing: border-box; overflow-x: hidden; overflow-y: auto; min-height: 0; min-width: 0; max-width: 100%; padding-bottom: max(28px, env(safe-area-inset-bottom)); }

.page-enter-active, .page-leave-active { transition: all 0.28s cubic-bezier(0.4,0,0.2,1); }
.page-enter-from { opacity: 0; transform: translateY(10px); }
.page-leave-to   { opacity: 0; transform: translateY(-8px); }

@media (max-width: 768px) {
  .layout-main   { margin-left: 0; width: 100%; max-width: 100vw; }
  .layout-content { padding: 16px; padding-bottom: max(16px, env(safe-area-inset-bottom)); width: 100%; }
}
</style>
