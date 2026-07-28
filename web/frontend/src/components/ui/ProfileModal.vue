<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="profile-overlay" @click.self="$emit('update:modelValue', false)">
        <div class="profile-drawer">
          <!-- Header -->
          <div class="pd-header">
            <div class="pd-avatar">
              <img v-if="avatarUrl" :src="avatarUrl" :alt="user?.name || 'Profile photo'" class="pd-avatar-img" />
              <span v-else>{{ initials }}</span>
            </div>
            <div class="pd-header-info">
              <div class="pd-name">{{ user?.name }}</div>
              <div class="pd-role">{{ roleLabel }}</div>
            </div>
            <button class="pd-close" @click="$emit('update:modelValue', false)">
              <AppIcon name="x-circle" :size="20" />
            </button>
          </div>

          <!-- Info section (read-only) -->
          <div class="pd-section">
            <div class="pd-section-title">Account Info</div>
            <div class="pd-info-grid">
              <div class="pd-info-row">
                <AppIcon name="user" :size="14" color="var(--text-muted)" />
                <div>
                  <div class="pd-info-label">Email</div>
                  <div class="pd-info-val">{{ user?.email }}</div>
                </div>
              </div>
              <div v-if="schoolName" class="pd-info-row">
                <AppIcon name="school" :size="14" color="var(--text-muted)" />
                <div>
                  <div class="pd-info-label">{{ vocab.orgNoun }}</div>
                  <div class="pd-info-val">{{ schoolName }}</div>
                </div>
              </div>
              <div class="pd-info-row">
                <AppIcon name="shield" :size="14" color="var(--text-muted)" />
                <div>
                  <div class="pd-info-label">Role</div>
                  <div class="pd-info-val">{{ roleLabel }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Edit profile → Settings -->
          <div class="pd-section pd-edit-cta-section">
            <button class="pd-edit-cta" @click="goToSettings">
              <AppIcon name="settings" :size="16" />
              <span>Edit Profile in Settings</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
import { useScrollLock } from '../../composables/useScrollLock'
import { useIndustry } from '../../composables/useIndustry'
import { toRef } from 'vue'

const props = defineProps({
  modelValue: Boolean,
  user: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue'])

useScrollLock(toRef(props, 'modelValue'))

const router = useRouter()

const initials = computed(() =>
  (props.user?.name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
)

// Global-industry-aware role label — falls back to 'School Administrator' /
// 'Teacher' automatically since useIndustry() defaults to the 'school' vocabulary.
const { vocab } = useIndustry()
const roleLabel = computed(() => ({
  super_admin:  'Super Administrator',
  school_admin: vocab.value.adminLabel,
  teacher:      vocab.value.personNoun,
}[props.user?.role] || props.user?.role || ''))

const schoolName = computed(() =>
  props.user?.school?.name || props.user?.teacher?.school_name || null
)

// Show an actual profile photo if one is set on the account; otherwise
// fall back to the initials avatar used throughout the rest of the app.
const API = import.meta.env.VITE_API_URL || 'https://esa-system.onrender.com/api'
const apiBase = API.replace('/api', '')
const avatarUrl = computed(() => {
  const url = props.user?.avatar
  if (!url) return null
  if (url.startsWith('http') || url.startsWith('//')) return url
  return `${apiBase}${url}`
})

const settingsRouteByRole = {
  super_admin:  '/super/settings',
  school_admin: '/school/settings',
  teacher:      '/teacher/profile',
}

function goToSettings() {
  emit('update:modelValue', false)
  const target = settingsRouteByRole[props.user?.role] || '/teacher/profile'
  router.push(target)
}
</script>

<style scoped>
.profile-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: flex-start; justify-content: flex-end;
}

.profile-drawer {
  width: 100%; max-width: 380px; height: 100vh; height: 100dvh;
  background: var(--surface); border-left: 1px solid var(--surface-border);
  overflow-y: auto; display: flex; flex-direction: column; gap: 0;
  box-shadow: -12px 0 48px rgba(0,0,0,0.2);
}

/* Header */
.pd-header {
  display: flex; align-items: center; gap: 14px;
  height: 76px;
  padding-left: 20px;
  padding-right: 20px;
  background: linear-gradient(135deg, rgba(37,99,235,0.08), rgba(6,182,212,0.05));
  border-bottom: 1px solid var(--surface-border);
}
.pd-avatar {
  width: 52px; height: 52px; border-radius: 16px; flex-shrink: 0;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 20px; font-weight: 800;
  overflow: hidden;
}
.pd-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 16px; }
.pd-header-info { flex: 1; min-width: 0; }
.pd-name { font-size: 17px; font-weight: 800; }
.pd-role { font-size: 12px; color: var(--text-muted); margin-top: 3px; }
.pd-close {
  width: 34px; height: 34px; border-radius: var(--radius-sm);
  border: 1px solid var(--surface-border); background: transparent;
  color: var(--text-muted); cursor: pointer; display: flex;
  align-items: center; justify-content: center; transition: all 0.2s;
}
.pd-close:hover { color: var(--danger); border-color: var(--danger); }

/* Sections */
.pd-section { padding: 22px 24px; border-bottom: 1px solid var(--surface-border); }
.pd-section-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: 14px;
}

/* Info grid */
.pd-info-grid { display: flex; flex-direction: column; gap: 10px; }
.pd-info-row {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  background: var(--bg); border: 1px solid var(--surface-border);
}
.pd-info-label { font-size: 11px; color: var(--text-muted); margin-bottom: 2px; }
.pd-info-val { font-size: 13px; font-weight: 600; }

/* Edit-profile CTA → Settings */
.pd-edit-cta-section { border-bottom: none; }
.pd-edit-cta {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; border-radius: var(--radius-sm);
  border: 1.5px solid var(--surface-border);
  background: var(--bg); color: var(--text);
  font-size: 14px; font-weight: 600; cursor: pointer;
  font-family: var(--font); transition: all 0.2s;
}
.pd-edit-cta span { flex: 1; text-align: left; }
.pd-edit-cta:hover { border-color: var(--primary); color: var(--primary); background: rgba(37,99,235,0.06); }

/* Transition */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.25s; }
.modal-fade-enter-active .profile-drawer, .modal-fade-leave-active .profile-drawer { transition: transform 0.28s cubic-bezier(0.4,0,0.2,1); }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .profile-drawer, .modal-fade-leave-to .profile-drawer { transform: translateX(100%); }

/* Mobile — leave a 20% strip of the overlay clickable at the left of the
   drawer so users can tap it to close, same as the sidebar's own overlay. */
@media (max-width: 768px) {
  .profile-drawer { width: 80%; max-width: 80%; }
}
</style>
