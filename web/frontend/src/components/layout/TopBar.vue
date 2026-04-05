<template>
  <header class="topbar">
    <div class="topbar-left">
      <button class="hamburger" @click="$emit('toggle-sidebar')">
        <AppIcon name="menu" :size="20" />
      </button>
      <div class="page-title-wrap">
        <h2 class="page-title">{{ title }}</h2>
        <p v-if="subtitle" class="page-subtitle">{{ subtitle }}</p>
      </div>
    </div>

    <div class="topbar-right">
      <!-- Live indicator -->
      <div class="live-badge">
        <span class="live-dot"></span>
        <span>LIVE</span>
      </div>

      <!-- Date -->
      <div class="topbar-date">{{ dateStr }}</div>

      <!-- Notifications -->
      <button class="topbar-btn" @click="$emit('notifications')">
        <AppIcon name="bell" :size="18" />
        <span v-if="notifCount" class="notif-dot">{{ notifCount }}</span>
      </button>

      <!-- Theme toggle -->
      <button class="topbar-btn theme-btn" @click="$emit('toggle-theme')" :title="isDark ? 'Light mode' : 'Dark mode'">
        <Transition name="icon-swap" mode="out-in">
          <AppIcon v-if="isDark" name="sun" :size="18" key="sun" />
          <AppIcon v-else name="moon" :size="18" key="moon" />
        </Transition>
      </button>

      <!-- User avatar — click to open profile -->
      <div class="user-chip" @click="$emit('open-profile')" title="View Profile">
        <div class="user-chip-avatar">{{ initials }}</div>
        <span class="user-chip-name">{{ userName }}</span>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import AppIcon from '../ui/AppIcon.vue'

const props = defineProps({
  title: { type: String, default: 'Dashboard' },
  subtitle: { type: String, default: '' },
  isDark: Boolean,
  userName: { type: String, default: '' },
  notifCount: { type: Number, default: 0 },
})
defineEmits(['toggle-sidebar', 'toggle-theme', 'notifications', 'open-profile'])


const initials = computed(() =>
  props.userName?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'
)

const dateStr = computed(() =>
  new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
)
</script>

<style scoped>
.topbar {
  position: sticky; top: 0; z-index: 50;
  background: var(--surface);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--surface-border);
  padding: 0 24px;
  height: 76px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px;
}
.topbar-left { display: flex; align-items: center; gap: 14px; }
.hamburger {
  width: 38px; height: 38px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--surface-border);
  background: var(--surface);
  color: var(--text-secondary);
  display: none; /* hidden on desktop, shown on mobile */
  align-items: center; justify-content: center;
  cursor: pointer;
  transition: all var(--transition);
  flex-shrink: 0;
}
.hamburger:hover { border-color: var(--primary); color: var(--primary); }

.page-title { font-size: 17px; font-weight: 700; line-height: 1.2; }
.page-subtitle { font-size: 12px; color: var(--text-muted); }

.topbar-right { display: flex; align-items: center; gap: 8px; }

.live-badge {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 99px;
  background: rgba(16,185,129,0.1);
  border: 1px solid rgba(16,185,129,0.2);
  font-size: 11px; font-weight: 700;
  color: var(--success); letter-spacing: 0.05em;
}
.live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--success);
  animation: pulse 1.5s ease-in-out infinite;
}

.topbar-date { font-size: 13px; color: var(--text-muted); font-weight: 500; white-space: nowrap; }

.topbar-btn {
  width: 38px; height: 38px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--surface-border);
  background: transparent;
  color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: all var(--transition);
  position: relative;
}
.topbar-btn:hover { border-color: var(--primary); color: var(--primary); background: rgba(37,99,235,0.06); }
.notif-dot {
  position: absolute; top: -4px; right: -4px;
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--danger); color: #fff;
  font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.theme-btn { transition: transform 0.001s cubic-bezier(0.34,1.56,0.64,1); }


.user-chip {
  display: flex; 
  align-items: center; 
  gap: 8px;
  padding: 5px 15px 5px 5px;
  border-radius: 99px;
  border: 1px solid var(--surface-border);
  background: var(--surface);
  cursor: pointer;
  transition: all var(--transition);
}
.user-chip:hover { border-color: var(--primary); background: rgba(37,99,235,0.06); }
.user-chip-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 11px; font-weight: 700;
}
.user-chip-name { font-size: 13px; font-weight: 600; }

/* Icon swap transition */
.icon-swap-enter-active, .icon-swap-leave-active { transition: all 0.2s; }
.icon-swap-enter-from { opacity: 0; transform: rotate(-90deg) scale(0.5); }
.icon-swap-leave-to   { opacity: 0; transform: rotate(90deg) scale(0.5); }

@keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.85); } }

@media (max-width: 768px) {
  .hamburger { display: flex; } /* show hamburger on mobile */
  .user-chip{
  padding: 5px 5px 5px 5px;
  }
}
@media (max-width: 640px) {
  .topbar-date, .user-chip-name, .live-badge { display: none; }
  .topbar { padding: 0 16px; }
}
</style>
