<template>
  <div class="epc glass">
    <div class="epc-header">
      <div class="epc-icon-wrap">
        <AppIcon name="user" :size="18" color="var(--primary)" />
      </div>
      <div>
        <div class="epc-title">Edit Profile</div>
        <div class="epc-subtitle">Update your photo, name, or password</div>
      </div>
    </div>

    <div class="epc-avatar-row">
      <AvatarUploader
        :avatar="props.user?.avatar"
        :name="form.name"
        size="lg"
        @uploaded="onAvatarUploaded"
      />
      <div class="epc-avatar-hint">
        <div class="epc-avatar-hint-title">Profile photo</div>
        <div class="epc-avatar-hint-desc">JPG or PNG, up to 3MB</div>
      </div>
    </div>

    <form @submit.prevent="save" class="epc-form">
      <div class="epc-form-group">
        <label class="epc-label">Full Name</label>
        <input v-model="form.name" class="epc-input" placeholder="Your full name" required />
      </div>
      <div class="epc-form-group">
        <label class="epc-label">New Password <span class="epc-optional">(leave blank to keep current)</span></label>
        <div class="epc-input-wrap">
          <input
            v-model="form.newPassword"
            :type="showPw ? 'text' : 'password'"
            class="epc-input"
            placeholder="Min 8 characters"
            minlength="8"
            autocomplete="new-password"
          />
          <button type="button" class="epc-pw-toggle" @click="showPw = !showPw">
            <AppIcon name="eye" :size="14" color="var(--text-muted)" />
          </button>
        </div>
      </div>
      <div v-if="form.newPassword" class="epc-form-group">
        <label class="epc-label">Confirm New Password</label>
        <input
          v-model="form.confirmPassword"
          :type="showPw ? 'text' : 'password'"
          class="epc-input"
          :class="{ 'input-error': form.confirmPassword && form.newPassword !== form.confirmPassword }"
          placeholder="Repeat password"
          autocomplete="new-password"
        />
        <span v-if="form.confirmPassword && form.newPassword !== form.confirmPassword" class="epc-error-hint">Passwords do not match</span>
      </div>

      <div v-if="errorMsg" class="epc-alert epc-alert-error">
        <AppIcon name="alert-triangle" :size="14" />{{ errorMsg }}
      </div>
      <div v-if="successMsg" class="epc-alert epc-alert-success">
        <AppIcon name="check-circle" :size="14" />{{ successMsg }}
      </div>

      <button
        type="submit"
        class="epc-save-btn"
        :disabled="saving || (form.newPassword && form.newPassword !== form.confirmPassword)"
      >
        <span v-if="saving" class="epc-spinner"></span>
        <AppIcon v-else name="check" :size="15" />
        {{ saving ? 'Saving…' : 'Save Changes' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import AvatarUploader from './AvatarUploader.vue'
import api from '../../api'

const props = defineProps({
  user: { type: Object, default: null },
})
const emit = defineEmits(['updated'])

const saving     = ref(false)
const showPw     = ref(false)
const errorMsg   = ref('')
const successMsg = ref('')
const form = ref({ name: props.user?.name || '', newPassword: '', confirmPassword: '' })

watch(() => props.user?.name, (name) => {
  if (name && !form.value.name) form.value.name = name
})

function onAvatarUploaded(updatedUser) {
  successMsg.value = 'Profile photo updated successfully!'
  emit('updated', updatedUser)
}

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
.epc { padding: 22px 24px; border-radius: var(--radius-xl); }
.epc-header { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.epc-icon-wrap {
  width: 38px; height: 38px; border-radius: var(--radius);
  background: rgba(37,99,235,0.1);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.epc-title { font-size: 15px; font-weight: 700; }
.epc-subtitle { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

.epc-avatar-row {
  display: flex; align-items: center; gap: 16px;
  padding-bottom: 20px; margin-bottom: 20px;
  border-bottom: 1px solid var(--surface-border);
}
.epc-avatar-hint-title { font-size: 13px; font-weight: 600; }
.epc-avatar-hint-desc { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

.epc-form { display: flex; flex-direction: column; gap: 14px; max-width: 100%; }
.epc-form-group { display: flex; flex-direction: column; gap: 6px; }
.epc-label {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--text-secondary);
}
.epc-optional { font-weight: 400; text-transform: none; color: var(--text-muted); font-size: 10px; }
.epc-input-wrap { position: relative; }
.epc-input {
  width: 100%; padding: 10px 12px; background: var(--bg);
  border: 1.5px solid var(--surface-border); border-radius: var(--radius-sm);
  color: var(--text); font-size: 14px; font-family: var(--font);
  transition: all 0.2s; box-sizing: border-box;
}
.epc-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-glow); }
.epc-input.input-error { border-color: var(--danger); }
.epc-pw-toggle {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; display: flex; padding: 4px;
}
.epc-error-hint { font-size: 11px; color: var(--danger); }

.epc-alert {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 500;
}
.epc-alert-error   { background: rgba(239,68,68,0.07);  border: 1px solid rgba(239,68,68,0.2); color: var(--danger); }
.epc-alert-success { background: rgba(16,185,129,0.07); border: 1px solid rgba(16,185,129,0.2); color: var(--success); }

.epc-save-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px; border-radius: var(--radius-sm); border: none;
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: #fff; font-size: 14px; font-weight: 700; cursor: pointer;
  transition: all 0.2s; font-family: var(--font);
  box-shadow: 0 4px 16px var(--primary-glow);
  width: fit-content;
}
.epc-save-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 8px 24px var(--primary-glow); }
.epc-save-btn:disabled { opacity: 0.65; cursor: not-allowed; }
.epc-spinner {
  width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
