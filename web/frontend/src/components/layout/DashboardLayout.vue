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
        :notifCount="0"
        @toggle-sidebar="sidebarOpen = !sidebarOpen"
        @toggle-theme="toggleDark"
        @notifications="showNotif = !showNotif"
        @open-profile="showProfile = true"
      />

      <main class="layout-content">
        <Transition name="page" mode="out-in">
          <slot />
        </Transition>
      </main>
    </div>

    <ToastNotification ref="toastRef" />
    <NotificationsPanel v-model="showNotif" />
    <ProfileModal v-model="showProfile" :user="user" @updated="onProfileUpdated" />
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

async function onProfileUpdated(updatedUser) {
  if (updatedUser && auth.user) {
    auth.user.name = updatedUser.name || auth.user.name
    localStorage.setItem('esa_user', JSON.stringify(auth.user))
  }
}

function checkMobile() {
  isMobile.value = window.innerWidth < 768
  if (!isMobile.value) sidebarOpen.value = true
}

onMounted(() => window.addEventListener('resize', checkMobile))
onUnmounted(() => window.removeEventListener('resize', checkMobile))

// ── Swipe gesture to open/close sidebar ──────────────────────────────────
let touchStartX = 0
let touchStartY = 0

function onTouchStart(e) {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
}

function onTouchEnd(e) {
  if (!isMobile.value) return
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
  display: flex; min-height: 100vh;
  background: var(--bg); position: relative;
}
.layout-main {
  flex: 1; margin-left: 264px; min-height: 100vh;
  display: flex; flex-direction: column;
  transition: margin-left var(--transition);
  position: relative; z-index: 1;
}
.layout-content { flex: 1; padding: 28px; padding-right: 28px; box-sizing: border-box; overflow-x: hidden; overflow-y: auto; min-height: 0; }

.page-enter-active, .page-leave-active { transition: all 0.28s cubic-bezier(0.4,0,0.2,1); }
.page-enter-from { opacity: 0; transform: translateY(10px); }
.page-leave-to   { opacity: 0; transform: translateY(-8px); }

@media (max-width: 768px) {
  .layout-main   { margin-left: 0; }
  .layout-content { padding: 16px; }
}
</style>
