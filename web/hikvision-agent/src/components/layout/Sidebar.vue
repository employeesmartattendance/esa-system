<template>
  <nav class="sidebar" role="navigation" aria-label="Main navigation">
    <div class="sidebar-brand">
      <div class="brand-icon">
        <svg viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#e94560"/>
          <path d="M10 22V10h3l5 7 5-7h3v12h-3v-7l-5 7-5-7v7h-3z" fill="white"/>
        </svg>
      </div>
      <span class="brand-text">ESA Agent</span>
    </div>

    <div class="sidebar-nav">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        custom
        v-slot="{ isActive, navigate }"
      >
        <button
          class="nav-item"
          :class="{ active: isActive }"
          @click="navigate"
          :title="item.label"
        >
          <span class="icon" v-html="item.icon"></span>
          <span class="nav-label">{{ item.label }}</span>
          <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
        </button>
      </router-link>
    </div>

    <div class="sidebar-footer">
      <div class="agent-status-indicator" :class="statusClass">
        <span class="status-dot" :class="statusDotClass"></span>
        <span class="status-text">{{ statusText }}</span>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import icons from '../../icons/index.js';
import { useAgent } from '../../composables/useAgent.js';

const route = useRoute();
const { agentStatus } = useAgent();

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: icons.dashboard },
  { path: '/setup', label: 'Setup', icon: icons.setup },
  { path: '/devices', label: 'Devices', icon: icons.device },
  { path: '/esa', label: 'ESA Backend', icon: icons.cloud },
  { path: '/fingerprint', label: 'Fingerprint', icon: icons.fingerprint },
  { path: '/events', label: 'Events', icon: icons.event },
  { path: '/logs', label: 'Logs', icon: icons.log },
  { path: '/settings', label: 'Settings', icon: icons.settings },
];

const statusClass = computed(() => {
  if (agentStatus.running) return 'status-running';
  return 'status-stopped';
});

const statusDotClass = computed(() => {
  if (agentStatus.running) return 'connected';
  return 'disconnected';
});

const statusText = computed(() => {
  if (agentStatus.running) return 'Running';
  return 'Stopped';
});
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  background: var(--color-sidebar-bg);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-right: 1px solid rgba(255,255,255,0.06);
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 16px 12px;
}
.brand-icon svg {
  width: 28px;
  height: 28px;
}
.brand-text {
  font-size: 14px;
  font-weight: 700;
  color: white;
  letter-spacing: 0.3px;
}

.sidebar-nav {
  flex: 1;
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: none;
  border-radius: var(--border-radius-sm);
  background: transparent;
  color: var(--color-sidebar-text);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all var(--transition-fast);
  text-align: left;
  width: 100%;
  outline: none;
}
.nav-item:hover {
  background: var(--color-sidebar-hover-bg);
  color: var(--color-sidebar-text-active);
}
.nav-item.active {
  background: var(--color-sidebar-active-bg);
  color: var(--color-accent);
}
.nav-item .icon svg {
  width: 18px;
  height: 18px;
}
.nav-label {
  flex: 1;
}
.nav-badge {
  background: var(--color-accent);
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.agent-status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.status-text {
  color: var(--color-sidebar-text);
  font-weight: 500;
}
</style>