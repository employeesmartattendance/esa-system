<template>
  <aside :class="['sidebar', { open: modelValue }]">
    <div class="sidebar-logo">
      <div class="logo-icon">🧠</div>
      <div>
        <div class="logo-text">ESA</div>
        <div class="logo-sub">{{ roleLabel }}</div>
      </div>
    </div>

    <nav class="sidebar-nav">
      <div v-for="section in navSections" :key="section.label">
        <div v-if="section.label" class="nav-section-label">{{ section.label }}</div>
        <RouterLink
          v-for="item in section.items"
          :key="item.label"
          :to="item.to"
          class="nav-item"
          :class="{ active: currentSection === item.key }"
          @click="$emit('section', item.key); $emit('update:modelValue', false)"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
          <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
        </RouterLink>
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="user-info">
        <div class="user-avatar">{{ initials }}</div>
        <div class="user-details">
          <div class="user-name">{{ user?.name }}</div>
          <div class="user-role">{{ roleLabel }}</div>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm logout-btn" @click="handleLogout">🚪 Logout</button>
    </div>
  </aside>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { disconnectSocket } from '../socket'

const props = defineProps({ modelValue: Boolean, currentSection: String, navSections: Array })
const emit = defineEmits(['update:modelValue', 'section'])
const auth = useAuthStore()
const router = useRouter()
const user = computed(() => auth.user)

const roleLabel = computed(() => {
  const map = { super_admin: 'Super Admin', school_admin: 'School Admin', teacher: 'Teacher' }
  return map[user.value?.role] || ''
})

const initials = computed(() => {
  return user.value?.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'
})

function handleLogout() {
  disconnectSocket()
  auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.sidebar-nav { flex: 1; overflow-y: auto; }
.sidebar-footer { margin-top: auto; padding-top: 16px; border-top: 1px solid var(--surface-border); }
.user-info { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: var(--radius-sm); margin-bottom: 8px; }
.user-avatar {
  width: 38px; height: 38px; border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: 14px; flex-shrink: 0;
}
.user-name { font-size: 14px; font-weight: 600; }
.user-role { font-size: 11px; color: var(--text-muted); }
.logout-btn { width: 100%; justify-content: center; }
</style>
