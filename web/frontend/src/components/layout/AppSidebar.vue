<template>
  <!-- Mobile overlay -->
  <Transition name="fade">
    <div v-if="modelValue && isMobile" class="sidebar-overlay" @click="$emit('update:modelValue', false)" />
  </Transition>

  <aside :class="['sidebar', { 'sidebar-open': modelValue }]">
    <!-- Logo -->
    <div class="sidebar-brand">
      <div class="brand-logo brand-logo-img">
        <img src="/esa-logo.png" alt="ESA Logo" class="esa-logo-img" />
      </div>
      <div class="brand-text">
        <div class="brand-name">ESA</div>
        <div class="brand-tagline">Smart Attendance</div>
      </div>
      <button class="brand-close" @click="$emit('update:modelValue', false)">
        <AppIcon name="close" :size="16" />
      </button>
    </div>

    <!-- User pill -->
    <div class="user-pill">
      <div class="user-avatar">
        <img v-if="avatarUrl" :src="avatarUrl" :alt="user?.name" class="user-avatar-img" />
        <span v-else>{{ initials }}</span>
      </div>
      <div class="user-info">
        <div class="user-name">{{ user?.name }}</div>
        <div class="user-role">{{ roleLabel }}</div>
      </div>
      <div class="user-status-dot"></div>
    </div>

    <!-- Navigation -->
    <div class="sidebar-nav-wrap">
      <nav class="sidebar-nav" ref="navRef" @scroll.passive="handleNavScroll">
        <template v-for="section in navSections" :key="section.group">
          <div v-if="section.group" class="nav-group-label">{{ section.group }}</div>
          <RouterLink
            v-for="item in section.items"
            :key="item.to"
            :to="item.to"
            class="nav-link"
            :class="{ 'nav-active': isActive(item) }"
            @click="handleNavClick"
          >
            <span class="nav-link-icon">
              <AppIcon :name="item.icon" :size="18" />
            </span>
            <span class="nav-link-label">{{ item.label }}</span>
            <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
            <span v-if="isActive(item)" class="nav-active-pill" />
          </RouterLink>
        </template>
      </nav>

      <!-- Mobile-only "more links below" cue: centered chevron pinned to the
           bottom of the nav area, shown only while the list overflows and
           hasn't been scrolled to the end. Tapping it scrolls the nav down
           a bit so users discover links hidden below the fold. -->
      <Transition name="fade">
        <button
          v-if="isMobile && navOverflowing && !navAtBottom"
          type="button"
          class="nav-scroll-hint"
          aria-label="Scroll for more links"
          @click="scrollNavDown"
        >
          <AppIcon name="chevron-down" :size="16" />
        </button>
      </Transition>
    </div>

    <!-- Footer -->
    <div class="sidebar-footer">
      <button class="logout-btn" @click="requestLogout">
        <AppIcon name="logout" :size="16" color="var(--danger)" />
        <span>Sign Out</span>
      </button>
    </div>
  </aside>

  <!-- Sign out confirmation -->
  <AppModal v-model="showSignOutModal" title="Sign Out" subtitle="You'll need to sign in again to continue" icon="logout" icon-color="var(--danger)">
    <p style="font-size:14px;color:var(--text-secondary);margin-bottom:20px">
      Are you sure you want to sign out of your account?
    </p>
    <div class="form-actions">
      <button class="btn btn-ghost" @click="showSignOutModal = false">Cancel</button>
      <button class="btn btn-danger" @click="confirmLogout">
        <AppIcon name="logout" :size="15" />Sign Out
      </button>
    </div>
  </AppModal>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { disconnectSocket } from '../../socket'
import AppIcon from '../ui/AppIcon.vue'
import AppModal from '../ui/AppModal.vue'
import { useScrollLock } from '../../composables/useScrollLock'
import { useIndustry } from '../../composables/useIndustry'

const props = defineProps({
  modelValue: Boolean,
  navSections: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const isMobile = ref(false)

// Only lock background scroll when the sidebar is acting as a mobile
// overlay — on desktop it sits alongside the content, not on top of it.
useScrollLock(computed(() => props.modelValue && isMobile.value))

const user = computed(() => auth.user)
// Global-industry-aware role label — falls back to 'School Admin' / 'Teacher'
// automatically since useIndustry() defaults to the 'school' vocabulary.
const { vocab } = useIndustry()
const roleLabel = computed(() => ({
  super_admin: 'Super Admin',
  school_admin: vocab.value.adminLabel,
  teacher: vocab.value.personNoun,
})[user.value?.role] || '')

const initials = computed(() =>
  user.value?.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'
)

const API = import.meta.env.VITE_API_URL || 'https://esa-system.onrender.com/api'
const apiBase = API.replace('/api', '')
const avatarUrl = computed(() => {
  const url = user.value?.avatar
  if (!url) return null
  if (url.startsWith('http') || url.startsWith('//')) return url
  return `${apiBase}${url}`
})

function isActive(item) {
  return route.path === item.to || route.path.startsWith(item.to + '/')
}

function handleNavClick() {
  if (isMobile.value) emit('update:modelValue', false)
}

const showSignOutModal = ref(false)

// Clicking "Sign Out" closes the sidebar first (mobile overlay), then
// brings up the confirmation modal once the sidebar is out of the way.
function requestLogout() {
  if (isMobile.value) emit('update:modelValue', false)
  showSignOutModal.value = true
}

function confirmLogout() {
  showSignOutModal.value = false
  auth.signingOut = true
  disconnectSocket()
  // Let the signing-out overlay paint over the current page before the
  // user/session state clears, so nobody sees a flash of "undefined user"
  // in the sidebar during the brief window before the route changes.
  setTimeout(() => {
    auth.logout()
    router.push('/login').finally(() => { auth.signingOut = false })
  }, 300)
}

function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

// ── Mobile "scroll for more links" hint ──────────────────────────────────
// The nav list has no visible scrollbar (by design — see .sidebar-nav CSS),
// so on small screens with several nav sections there's otherwise no cue
// that more links exist below the fold. This tracks whether the nav
// content overflows its box and whether the user has already scrolled to
// the bottom, so a small centered chevron can appear/disappear accordingly.
const navRef = ref(null)
const navOverflowing = ref(false)
const navAtBottom = ref(false)

function updateNavOverflow() {
  const el = navRef.value
  if (!el) return
  navOverflowing.value = el.scrollHeight > el.clientHeight + 4
  navAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 12
}

function handleNavScroll() {
  updateNavOverflow()
}

function scrollNavDown() {
  const el = navRef.value
  if (!el) return
  el.scrollBy({ top: Math.min(el.clientHeight * 0.7, el.scrollHeight - el.scrollTop - el.clientHeight), behavior: 'smooth' })
}

let navResizeObserver = null

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  window.addEventListener('resize', updateNavOverflow)
  nextTickUpdateNavOverflow()
  if (navRef.value && typeof ResizeObserver !== 'undefined') {
    navResizeObserver = new ResizeObserver(updateNavOverflow)
    navResizeObserver.observe(navRef.value)
  }
})
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('resize', updateNavOverflow)
  navResizeObserver?.disconnect()
})

// Nav content (navSections) can arrive/change after mount (e.g. once the
// user/industry vocabulary loads), so re-check overflow shortly after —
// a plain onMounted check can run before the final link list is rendered.
function nextTickUpdateNavOverflow() {
  updateNavOverflow()
  setTimeout(updateNavOverflow, 250)
}
watch(() => props.navSections, () => { setTimeout(updateNavOverflow, 50) }, { deep: true })
</script>

<style scoped>
.sidebar-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 99;
}
.sidebar {
  width: 264px; flex-shrink: 0;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--surface-border);
  display: flex; flex-direction: column;
  padding: 0;
  position: fixed; left: 0; top: 0; bottom: 0;
  z-index: 100;
  overflow: hidden;
  transition: transform var(--transition), box-shadow var(--transition);
}

/* Brand */
.sidebar-brand {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 20px 16px;
  border-bottom: 1px solid var(--surface-border);
  position: relative;
}
.brand-logo {
  width: 40px; height: 40px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.brand-logo-img { background: transparent; }
.esa-logo-img { width: 40px; height: 40px; object-fit: contain; border-radius: 10px; }
.brand-name { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
.brand-tagline { font-size: 10px; color: var(--text-muted); font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; }
.brand-close {
  margin-left: auto; background: transparent; border: none; cursor: pointer;
  color: var(--text-muted); padding: 4px; border-radius: 6px;
  display: none; /* shown on mobile via media query */
  transition: color var(--transition);
}
.brand-close:hover { color: var(--text); }

/* User pill */
.user-pill {
  display: flex; align-items: center; gap: 10px;
  margin: 14px 16px;
  padding: 10px 12px;
  background: rgba(37,99,235,0.06);
  border: 1px solid rgba(37,99,235,0.12);
  border-radius: var(--radius);
  position: relative;
}
.user-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: 13px; flex-shrink: 0;
  overflow: hidden;
}
.user-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.user-name { font-size: 13px; font-weight: 600; line-height: 1.2; }
.user-role { font-size: 11px; color: var(--text-muted); }
.user-status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--success); margin-left: auto; flex-shrink: 0;
  box-shadow: 0 0 0 2px rgba(16,185,129,0.2);
}

/* Nav */
.sidebar-nav-wrap { flex: 1; min-height: 0; position: relative; display: flex; flex-direction: column; }
.sidebar-nav { flex: 1; overflow-y: auto; padding: 8px 12px; scrollbar-width: none; }
.sidebar-nav::-webkit-scrollbar { display: none; }

/* Scroll-to-bottom hint — mobile only, see media query below for visibility.
   Pinned to the bottom-right of the nav area, static (no floating/bounce
   animation), a perfect circle with no shadow. */
.nav-scroll-hint {
  display: none;
  position: absolute; right: 10px; bottom: 6px;
  width: 34px; height: 34px;
  aspect-ratio: 1 / 1;
  align-items: center; justify-content: center;
  background: var(--sidebar-bg, var(--surface));
  border: 1px solid var(--surface-border);
  border-radius: 50%;
  color: var(--primary);
  cursor: pointer;
  box-shadow: none;
  z-index: 2;
}
.nav-scroll-hint::before {
  content: '';
  position: absolute; right: 0; bottom: 100%;
  width: 64px; height: 26px;
  background: linear-gradient(to bottom, transparent, var(--sidebar-bg, var(--surface)) 85%);
  pointer-events: none;
}
.nav-group-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.1em; color: var(--text-muted);
  padding: 12px 8px 4px; margin-top: 4px;
}
.nav-link {
  display: flex; align-items: center; gap: 11px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  transition: all var(--transition);
  cursor: pointer; position: relative;
  margin-bottom: 2px;
}
.nav-link:hover { color: var(--primary); }
.nav-active {
  background: linear-gradient(135deg, rgba(37,99,235,0.12), rgba(6,182,212,0.07));
  color: var(--primary);
  font-weight: 600;
}
.nav-link-icon { display: flex; align-items: center; flex-shrink: 0; }
.nav-link-label { flex: 1; }
.nav-badge {
  background: var(--primary); color: #fff;
  font-size: 10px; font-weight: 700;
  padding: 2px 6px; border-radius: 99px;
}
.nav-active-pill {
  position: absolute; left: 0; top: 50%;
  transform: translateY(-50%);
  width: 3px; height: 60%;
  background: var(--primary);
  border-radius: 0 3px 3px 0;
}

/* Footer */
.sidebar-footer {
  padding: 12px 16px 20px;
  border-top: 1px solid var(--surface-border);
}
.logout-btn {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  background: rgba(239,68,68,0.06);
  border: 1px solid rgba(239,68,68,0.15);
  color: var(--danger); font-size: 14px; font-weight: 600;
  cursor: pointer; transition: all var(--transition);
}
.logout-btn:hover { background: rgba(239,68,68,0.12); }

.form-actions { display: flex; justify-content: flex-end; gap: 10px; }

/* Mobile */
@media (max-width: 768px) {
  .sidebar { transform: translateX(-100%); }
  .sidebar-open { transform: translateX(0); box-shadow: 8px 0 40px rgba(0,0,0,0.3); }
  .brand-close { display: flex; }
  .nav-scroll-hint { display: flex; }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
