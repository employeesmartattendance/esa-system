<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="profile-overlay" @click.self="$emit('update:modelValue', false)">
        <div class="profile-drawer">
          <!-- Header -->
          <div class="pd-header">
            <div class="pd-avatar">{{ initials }}</div>
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
                  <div class="pd-info-label">School</div>
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

          <!-- Edit section -->
          <div class="pd-section">
            <div class="pd-section-title">Edit Profile</div>
            <form @submit.prevent="save" class="pd-form">
              <div class="pd-form-group">
                <label class="pd-label">Full Name</label>
                <input v-model="form.name" class="pd-input" placeholder="Your full name" required />
              </div>
              <div class="pd-form-group">
                <label class="pd-label">New Password <span class="pd-optional">(leave blank to keep current)</span></label>
                <div class="pd-input-wrap">
                  <input
                    v-model="form.newPassword"
                    :type="showPw ? 'text' : 'password'"
                    class="pd-input"
                    placeholder="Min 8 characters"
                    minlength="8"
                    autocomplete="new-password"
                  />
                  <button type="button" class="pd-pw-toggle" @click="showPw = !showPw">
                    <AppIcon name="eye" :size="14" color="var(--text-muted)" />
                  </button>
                </div>
              </div>
              <div v-if="form.newPassword" class="pd-form-group">
                <label class="pd-label">Confirm New Password</label>
                <input
                  v-model="form.confirmPassword"
                  :type="showPw ? 'text' : 'password'"
                  class="pd-input"
                  :class="{ 'input-error': form.confirmPassword && form.newPassword !== form.confirmPassword }"
                  placeholder="Repeat password"
                  autocomplete="new-password"
                />
                <span v-if="form.confirmPassword && form.newPassword !== form.confirmPassword" class="pd-error-hint">Passwords do not match</span>
              </div>

              <div v-if="errorMsg" class="pd-alert pd-alert-error">
                <AppIcon name="alert-triangle" :size="14" />{{ errorMsg }}
              </div>
              <div v-if="successMsg" class="pd-alert pd-alert-success">
                <AppIcon name="check-circle" :size="14" />{{ successMsg }}
              </div>

              <button
                type="submit"
                class="pd-save-btn"
                :disabled="saving || (form.newPassword && form.newPassword !== form.confirmPassword)"
              >
                <span v-if="saving" class="pd-spinner"></span>
                <AppIcon v-else name="check" :size="15" />
                {{ saving ? 'Saving…' : 'Save Changes' }}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import api from '../../api'

const props = defineProps({
  modelValue: Boolean,
  user: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'updated'])

const saving     = ref(false)
const showPw     = ref(false)
const errorMsg   = ref('')
const successMsg = ref('')
const form = ref({ name: '', newPassword: '', confirmPassword: '' })

const initials = computed(() =>
  (props.user?.name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
)

const roleLabel = computed(() => ({
  super_admin:  'Super Administrator',
  school_admin: 'School Administrator',
  teacher:      'Teacher',
}[props.user?.role] || props.user?.role || ''))

const schoolName = computed(() =>
  props.user?.school?.name || props.user?.teacher?.school_name || null
)

// Reset form when modal opens
watch(() => props.modelValue, (open) => {
  if (open) {
    form.value = { name: props.user?.name || '', newPassword: '', confirmPassword: '' }
    errorMsg.value   = ''
    successMsg.value = ''
    showPw.value     = false
  }
})

async function save() {
  errorMsg.value   = ''
  successMsg.value = ''
  if (form.value.newPassword && form.value.newPassword !== form.value.confirmPassword) {
    errorMsg.value = 'Passwords do not match'
    return
  }
  saving.value = true
  try {
    const payload = { name: form.value.name }
    if (form.value.newPassword) payload.newPassword = form.value.newPassword
    const updated = await api.put('/auth/profile', payload)
    successMsg.value = 'Profile updated successfully!'
    form.value.newPassword     = ''
    form.value.confirmPassword = ''
    emit('updated', updated)
  } catch (e) {
    errorMsg.value = e.response?.data?.message || 'Failed to update profile'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.profile-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
  display: flex; align-items: flex-start; justify-content: flex-end;
}

.profile-drawer {
  width: 100%; max-width: 380px; height: 100vh;
  background: var(--surface); border-left: 1px solid var(--surface-border);
  overflow-y: auto; display: flex; flex-direction: column; gap: 0;
  box-shadow: -12px 0 48px rgba(0,0,0,0.2);
}

/* Header */
.pd-header {
  display: flex; align-items: center; gap: 14px;
  /* padding: 28px 24px 22px; */
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
}
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

/* Form */
.pd-form { display: flex; flex-direction: column; gap: 14px; }
.pd-form-group { display: flex; flex-direction: column; gap: 6px; }
.pd-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-secondary);
}
.pd-optional { font-weight: 400; text-transform: none; color: var(--text-muted); font-size: 10px; }
.pd-input-wrap { position: relative; }
.pd-input {
  width: 100%; padding: 10px 12px; background: var(--bg);
  border: 1.5px solid var(--surface-border); border-radius: var(--radius-sm);
  color: var(--text); font-size: 14px; font-family: var(--font);
  transition: all 0.2s; box-sizing: border-box;
}
.pd-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-glow); }
.pd-input.input-error { border-color: var(--danger); }
.pd-pw-toggle {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; display: flex; padding: 4px;
}
.pd-error-hint { font-size: 11px; color: var(--danger); }

.pd-alert {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 500;
}
.pd-alert-error   { background: rgba(239,68,68,0.07);  border: 1px solid rgba(239,68,68,0.2); color: var(--danger); }
.pd-alert-success { background: rgba(16,185,129,0.07); border: 1px solid rgba(16,185,129,0.2); color: var(--success); }

.pd-save-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px; border-radius: var(--radius-sm); border: none;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: #fff; font-size: 14px; font-weight: 700; cursor: pointer;
  transition: all 0.2s; font-family: var(--font);
  box-shadow: 0 4px 16px var(--primary-glow);
}
.pd-save-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 8px 24px var(--primary-glow); }
.pd-save-btn:disabled { opacity: 0.65; cursor: not-allowed; }
.pd-spinner {
  width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Transition */
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.25s; }
.modal-fade-enter-active .profile-drawer, .modal-fade-leave-active .profile-drawer { transition: transform 0.28s cubic-bezier(0.4,0,0.2,1); }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
.modal-fade-enter-from .profile-drawer, .modal-fade-leave-to .profile-drawer { transform: translateX(100%); }
</style>
