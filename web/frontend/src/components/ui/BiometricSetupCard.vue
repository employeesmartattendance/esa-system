<template>
  <div class="bsc glass">
    <div class="bsc-header">
      <div class="bsc-icon-wrap" :class="{ 'bsc-icon-ok': status === true }">
        <AppIcon name="shield" :size="18" :color="status === true ? 'var(--success)' : 'var(--primary)'" />
      </div>
      <div class="bsc-header-text">
        <div class="bsc-title">Biometric Verification</div>
        <div class="bsc-subtitle">Face verification — required to check in</div>
      </div>
      <AppBadge
        v-if="status !== null"
        :variant="status ? 'active' : 'inactive'"
        :label="status ? 'Enrolled' : 'Not set up'"
        dot
      />
    </div>

    <!-- Loading -->
    <div v-if="status === null" class="bsc-loading">
      <span class="bsc-spinner"></span>
      <span>Checking status…</span>
    </div>

    <!-- Not supported in this browser/app -->
    <div v-else-if="!biometric.isSupported" class="bsc-notice bsc-notice-warn">
      <AppIcon name="alert-triangle" :size="15" color="var(--warning)" />
      <span>Biometric verification needs camera access, which isn't available on this device or browser. Try the installed mobile app, or a recent version of Chrome or Safari.</span>
    </div>

    <!-- Enrolled — locked. Only a company admin can reset this. -->
    <template v-else-if="status === true">
      <div class="bsc-enrolled-row">
        <AppIcon name="user-check" :size="16" color="var(--success)" />
        <div class="bsc-enrolled-text">
          <div class="bsc-enrolled-title">Set up and locked</div>
          <div class="bsc-enrolled-sub">{{ deviceLabel || 'Registered device' }}{{ enrolledAt ? ' · since ' + fmtDate(enrolledAt) : '' }}</div>
        </div>
      </div>

      <div class="bsc-notice bsc-notice-locked">
        <AppIcon name="shield" :size="14" color="var(--text-muted)" />
        <span>For your security, this is locked. If you need to re-enroll (e.g. verification keeps failing), you can remove it below, or ask your company admin to reset it.</span>
      </div>

      <button class="btn btn-ghost-danger" @click="confirmRemove" :disabled="removing">
        <span v-if="removing" class="bsc-spinner-sm"></span>
        <AppIcon v-else name="trash" :size="14" />
        {{ removing ? 'Removing…' : 'Remove My Enrollment' }}
      </button>
    </template>

    <!-- Not enrolled — prompt to set up -->
    <template v-else>
      <div class="bsc-notice" :class="{ 'bsc-notice-required': biometricRequired }">
        <AppIcon name="info" :size="15" color="var(--primary)" />
        <span v-if="biometricRequired">Your {{ vocab.orgNoun.toLowerCase() }} requires biometric verification to check in. Set it up now using your camera.</span>
        <span v-else>Set up face verification now so you're ready if your {{ vocab.orgNoun.toLowerCase() }} turns on biometric check-in.</span>
      </div>

      <button class="btn btn-primary" @click="showCapture = true" :disabled="enrolling">
        <AppIcon name="camera" :size="15" />
        Set Up Face Verification
      </button>
    </template>

    <div v-if="errorMsg" class="bsc-notice bsc-notice-error">
      <AppIcon name="alert-triangle" :size="14" color="var(--danger)" />
      <span>{{ errorMsg }}</span>
    </div>

    <FaceCaptureModal
      v-model="showCapture"
      mode="enroll"
      @success="onEnrollSuccess"
      @error="(msg) => { if (msg) errorMsg = msg }"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppIcon from './AppIcon.vue'
import AppBadge from './AppBadge.vue'
import FaceCaptureModal from './FaceCaptureModal.vue'
import { useBiometric } from '../../composables/useBiometric'
import { useToast } from '../../composables/useToast'
import { useIndustry } from '../../composables/useIndustry'
import api from '../../api'

const { vocab } = useIndustry()
const toast = useToast()
const biometric = useBiometric()

const status          = ref(null)   // null = loading, true/false once known
const deviceLabel      = ref(null)
const enrolledAt       = ref(null)
const biometricRequired = ref(false) // school-wide setting: is biometric mandatory to check in
const enrolling        = ref(false)
const removing         = ref(false)
const showCapture      = ref(false)
const errorMsg         = ref('')

function fmtDate(d) {
  try { return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return '' }
}

async function loadStatus() {
  errorMsg.value = ''
  try {
    const r = await api.get('/biometric/status')
    status.value      = !!r?.enrolled
    deviceLabel.value = r?.device_label || null
    enrolledAt.value  = r?.enrolled_at || null
  } catch (e) {
    status.value = false
    errorMsg.value = e.response?.data?.message || 'Could not check biometric status'
  }
}

async function loadSchoolSetting() {
  try {
    const r = await api.get('/teacher/settings')
    biometricRequired.value = !!r?.biometric_enabled
  } catch { /* non-fatal — just skip the "required" messaging */ }
}

async function onEnrollSuccess() {
  errorMsg.value = ''
  toast.success('Biometric verification set up — you can now use it to check in')
  await loadStatus()
}

async function confirmRemove() {
  if (removing.value) return
  if (!confirm('Remove your biometric enrollment? You will need to set it up again before your next check-in.')) return
  removing.value = true
  try {
    await api.delete('/biometric/self')
    toast.success('Biometric enrollment removed')
    await loadStatus()
  } catch (e) {
    toast.error(e.response?.data?.message || 'Could not remove biometric enrollment')
  } finally {
    removing.value = false
  }
}

onMounted(() => {
  loadStatus()
  loadSchoolSetting()
})
</script>

<style scoped>
.bsc { padding: 22px 24px; border-radius: var(--radius-xl); }
.bsc-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.bsc-icon-wrap {
  width: 38px; height: 38px; border-radius: var(--radius);
  background: rgba(37,99,235,0.1);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.bsc-icon-ok { background: rgba(16,185,129,0.12); }
.bsc-header-text { flex: 1; min-width: 0; }
.bsc-title { font-size: 15px; font-weight: 700; }
.bsc-subtitle { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

.bsc-loading {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--text-muted); padding: 6px 0;
}

.bsc-notice {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  font-size: 12.5px; line-height: 1.5; color: var(--text-secondary);
  background: rgba(37,99,235,0.06); border: 1px solid rgba(37,99,235,0.15);
  margin-bottom: 14px;
}
.bsc-notice-required { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.25); }
.bsc-notice-warn { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.25); }
.bsc-notice-locked { background: var(--bg); border-color: var(--surface-border); color: var(--text-muted); margin-bottom: 0; }
.bsc-notice-error { background: rgba(239,68,68,0.07); border-color: rgba(239,68,68,0.2); color: var(--danger); margin-top: 12px; margin-bottom: 0; }

.bsc-enrolled-row {
  display: flex; align-items: center; gap: 10px;
  padding: 12px; border-radius: var(--radius-sm);
  background: rgba(16,185,129,0.06); border: 1px solid rgba(16,185,129,0.2);
  margin-bottom: 14px;
}
.bsc-enrolled-text { flex: 1; min-width: 0; }
.bsc-enrolled-title { font-size: 13px; font-weight: 700; }
.bsc-enrolled-sub { font-size: 11.5px; color: var(--text-muted); margin-top: 2px; }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 16px; border-radius: var(--radius-sm); border: none;
  font-size: 14px; font-weight: 700; cursor: pointer;
  transition: all 0.2s; font-family: var(--font);
}
.btn:disabled { opacity: 0.65; cursor: not-allowed; }
.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: #fff; box-shadow: 0 4px 16px var(--primary-glow);
}
.btn-primary:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 8px 24px var(--primary-glow); }
.btn-ghost-danger {
  background: transparent; border: 1px solid rgba(239,68,68,0.3); color: var(--danger);
  width: 100%; margin-top: 4px;
}
.btn-ghost-danger:not(:disabled):hover { background: rgba(239,68,68,0.08); }

.bsc-spinner, .bsc-spinner-sm {
  border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: bsc-spin 0.7s linear infinite; flex-shrink: 0;
}
.bsc-spinner { width: 14px; height: 14px; }
.bsc-spinner-sm { width: 12px; height: 12px; }
@keyframes bsc-spin { to { transform: rotate(360deg); } }
</style>
