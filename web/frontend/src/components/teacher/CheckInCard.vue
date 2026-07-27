<template>
  <div class="checkin-card glass">
    <!-- Header row -->
    <div class="card-header">
      <div class="teacher-greeting">
        <div class="greeting-avatar">
          <img v-if="avatarUrl" :src="avatarUrl" :alt="user?.name" class="greeting-avatar-img" />
          <span v-else>{{ initials }}</span>
        </div>
        <div>
          <div class="greeting-text">Good {{ greeting }},</div>
          <div class="teacher-name">{{ user?.name }}</div>
        </div>
      </div>
      <div class="date-pill">
        <AppIcon name="clock" :size="13" color="var(--text-muted)" />
        <span>{{ todayDate }}</span>
      </div>
    </div>

    <!-- Status display -->
    <div class="status-panel" :class="`status-${currentStatus}`">
      <div class="status-icon">
        <AppIcon :name="statusIcon" :size="32" />
      </div>
      <div class="status-content">
        <div class="status-label">{{ statusLabel }}</div>
        <div class="status-times" v-if="todayRecord?.check_in">
          <span class="time-chip in">
            <AppIcon name="checkin" :size="12" />
            {{ todayRecord.check_in }}
          </span>
          <span v-if="todayRecord?.check_out" class="time-arrow">→</span>
          <span v-if="todayRecord?.check_out" class="time-chip out">
            <AppIcon name="checkout" :size="12" />
            {{ todayRecord.check_out }}
          </span>
        </div>
        <div class="status-hint" v-else-if="currentStatus === 'none'">
          Tap Check In to record your attendance
        </div>
      </div>
    </div>

    <!-- ── WEB: GPS badges + action buttons ── -->
    <template v-if="!isDesktop">
      <!-- Verification badges -->
      <div class="verify-row">
        <div class="verify-badge" :class="gpsStatus">
          <AppIcon name="location" :size="13" />
          <span>GPS {{ gpsLabel }}</span>
        </div>
        <div class="verify-badge" :class="wifiStatus">
          <AppIcon name="wifi" :size="13" />
          <span>Wi-Fi {{ wifiLabel }}</span>
        </div>
      </div>

      <!-- Biometric: not yet enrolled on this device — first check-in sets it up -->
      <div v-if="schoolSettings?.biometric_enabled && biometricEnrolled === false" class="biometric-banner">
        <AppIcon name="shield" :size="16" color="var(--primary)" />
        <div class="biometric-banner-text">
          <div class="biometric-banner-title">Set up Face ID or fingerprint to check in</div>
          <div class="biometric-banner-sub">One-time setup — locked to this account once done. Only your admin can reset it.</div>
        </div>
        <button class="btn btn-primary btn-sm" @click="enrollBiometric" :disabled="enrolling || !biometric.isSupported">
          <span v-if="enrolling" class="btn-spinner-sm"></span>
          {{ enrolling ? 'Setting up...' : 'Set Up & Check In' }}
        </button>
      </div>
      <div v-else-if="schoolSettings?.biometric_enabled && !biometric.isSupported" class="biometric-banner biometric-banner-warn">
        <AppIcon name="alert-triangle" :size="16" color="var(--warning)" />
        <div class="biometric-banner-text">
          <div class="biometric-banner-title">Biometric verification isn't available in this browser</div>
          <div class="biometric-banner-sub">Try the installed app, or a recent version of Chrome or Safari</div>
        </div>
      </div>

      <!-- Biometric: arrived, waiting on a tap to verify and finish checking in -->
      <div v-if="pendingConfirm && biometricEnrolled === true" class="biometric-banner biometric-banner-active">
        <AppIcon name="user-check" :size="16" color="var(--primary)" />
        <div class="biometric-banner-text">
          <div class="biometric-banner-title">You've arrived</div>
          <div class="biometric-banner-sub">Verify with Face ID or fingerprint to finish checking in</div>
        </div>
        <button class="btn btn-primary btn-sm" @click="confirmPendingCheckIn" :disabled="biometric.busy.value">
          <span v-if="biometric.busy.value" class="btn-spinner-sm"></span>
          {{ biometric.busy.value ? 'Verifying...' : 'Verify' }}
        </button>
      </div>

      <!-- Biometric: arrived, but never enrolled yet — first check-in sets it up -->
      <div v-if="pendingConfirm && biometricEnrolled === false" class="biometric-banner biometric-banner-active">
        <AppIcon name="shield" :size="16" color="var(--primary)" />
        <div class="biometric-banner-text">
          <div class="biometric-banner-title">You've arrived — set up Face ID or fingerprint</div>
          <div class="biometric-banner-sub">One-time setup to finish your first check-in. Locked once done — only your admin can reset it.</div>
        </div>
        <button class="btn btn-primary btn-sm" @click="confirmPendingEnrollment" :disabled="enrolling || biometric.busy.value">
          <span v-if="enrolling" class="btn-spinner-sm"></span>
          {{ enrolling ? 'Setting up...' : 'Set Up & Check In' }}
        </button>
      </div>

      <!-- Action buttons -->
      <div class="action-row">
        <!-- Not checked in yet -->
        <button
          v-if="!todayRecord?.check_in"
          class="action-btn checkin-btn"
          @click="checkIn"
          :disabled="loading || !positionReady"
        >
          <div v-if="loading" class="action-spinner"></div>
          <AppIcon v-else name="checkin" :size="22" />
          <span>{{ loading ? 'Verifying...' : 'Check In' }}</span>
        </button>

        <!-- Checked in, not out -->
        <button
          v-else-if="!todayRecord?.check_out"
          class="action-btn checkout-btn"
          @click="checkOut"
          :disabled="loading"
        >
          <div v-if="loading" class="action-spinner"></div>
          <AppIcon v-else name="checkout" :size="22" />
          <span>{{ loading ? 'Processing...' : 'Check Out' }}</span>
        </button>

        <!-- Complete -->
        <div v-else class="day-done">
          <AppIcon name="check-circle" :size="18" color="var(--success)" />
          <span>Day complete · {{ todayRecord.check_in }} – {{ todayRecord.check_out }}</span>
        </div>

        <!-- Refresh GPS button -->
        <button
          class="refresh-btn"
          @click="detectLocation"
          :disabled="detectingLocation"
          title="Refresh GPS"
        >
          <AppIcon name="refresh" :size="16" :class="{ spinning: detectingLocation }" />
        </button>
      </div>

      <!-- Error message -->
      <div v-if="errorMsg" class="error-msg">
        <AppIcon name="alert-triangle" :size="14" />
        <span>{{ errorMsg }}</span>
      </div>
    </template>

    <!-- ── DESKTOP: no GPS features — show read-only notice ── -->
    <div v-else class="desktop-checkin-notice">
      <AppIcon name="info" :size="15" color="var(--primary)" />
      <span>Check-in via GPS is only available on the mobile app. Your status above is updated in real-time.</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import { useAuthStore } from '../../stores/auth'
import { useToast } from '../../composables/useToast'
import { useBiometric } from '../../composables/useBiometric'
import api from '../../api'

const props  = defineProps({
  todayRecord: { type: Object, default: null },
  // The mobile and desktop layouts both keep a CheckInCard mounted at all
  // times (toggled purely via CSS media queries), so without this guard
  // both instances would independently watch GPS and fire their own
  // auto check-in/out — causing duplicate toasts and duplicate API calls.
  // Only the instance meant for the active breakpoint should auto-watch.
  autoWatch: { type: Boolean, default: true },
})
const emit   = defineEmits(['refresh'])
const auth   = useAuthStore()
const toast  = useToast()

// ── Desktop detection ──────────────────────────────────────────────────────
const isDesktop = ref(typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron'))

const user        = computed(() => auth.user)
const initials    = computed(() => user.value?.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'T')

const API = import.meta.env.VITE_API_URL || 'https://esa-system.onrender.com/api'
const apiBase = API.replace('/api', '')
const avatarUrl = computed(() => {
  const url = user.value?.avatar
  if (!url) return null
  if (url.startsWith('http') || url.startsWith('//')) return url
  return `${apiBase}${url}`
})
const loading          = ref(false)
const detectingLocation = ref(false)
const currentPosition  = ref(null)
const gpsVerified      = ref(false)
const errorMsg         = ref('')

// ── Biometric verification (WebAuthn — Face ID / fingerprint / screen lock) ──
const biometric          = useBiometric()
const biometricEnrolled  = ref(null)   // null = not loaded yet, true/false once checked
const enrolling          = ref(false)
// Set when GPS auto-detects arrival but biometric_enabled means check-in can't
// complete silently — holds the coords until the employee taps to confirm.
const pendingConfirm     = ref(null)   // { lat, lng } | null

// Auto check-in/out state
const schoolSettings   = ref(null)
const wasInsideZone    = ref(null)  // null = unknown, true = inside, false = outside
let   autoWatchId      = null
let   autoCheckoutTime = null

/* ── Computed ── */
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Morning'
  if (h < 17) return 'Afternoon'
  return 'Evening'
})

const todayDate = computed(() =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
)

const currentStatus = computed(() => {
  if (!props.todayRecord?.check_in) return 'none'
  if (props.todayRecord?.check_out) return 'done'
  return props.todayRecord?.status || 'present'
})

const statusLabel = computed(() => ({
  none:    'Not Checked In',
  present: 'Present',
  late:    'Checked In — Late',
  absent:  'Marked Absent',
  done:    'Day Complete',
}[currentStatus.value] || 'Unknown'))

const statusIcon = computed(() => ({
  none:    'clock',
  present: 'check-circle',
  late:    'alert-triangle',
  absent:  'x-circle',
  done:    'check-circle',
}[currentStatus.value] || 'clock'))

// Status styles are handled by CSS classes

const positionReady = computed(() => currentPosition.value !== null)

const gpsStatus = computed(() => gpsVerified.value ? 'badge-ok' : positionReady.value ? 'badge-ready' : 'badge-fail')
const gpsLabel  = computed(() => gpsVerified.value ? 'Verified' : positionReady.value ? 'Located' : 'No Signal')
const wifiStatus = computed(() => 'badge-neutral')
const wifiLabel  = computed(() => 'Not required')

/* ── Distance helper ── */
function calcDist(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

/* ── Load school settings for auto check-in ── */
async function loadSchoolSettings() {
  try {
    const r = await api.get('/teacher/settings')
    schoolSettings.value = r
  } catch {}
}

/* ── Biometric enrollment status + self-enrollment ── */
async function loadBiometricStatus() {
  try {
    const r = await api.get('/biometric/status')
    biometricEnrolled.value = !!r?.enrolled
  } catch { biometricEnrolled.value = false }
}

async function enrollBiometric() {
  enrolling.value = true
  const ok = await biometric.enroll()
  enrolling.value = false
  if (ok) {
    biometricEnrolled.value = true
    toast.success('Biometric verification set up — checking you in now')
    // First-time setup flows straight into check-in as one action, so the
    // employee doesn't have to tap twice — enroll, then immediately verify
    // and check in with the same face/fingerprint they just registered.
    await checkIn()
  } else {
    toast.error(biometric.error.value || 'Could not set up biometric verification')
  }
}

/* ── Confirm a pending auto check-in that needed biometric verification ── */
async function confirmPendingCheckIn() {
  if (!pendingConfirm.value) return
  const { lat, lng } = pendingConfirm.value
  const token = await biometric.verify()
  if (!token) {
    toast.error(biometric.error.value || 'Biometric verification failed')
    return
  }
  pendingConfirm.value = null
  await doAutoCheckIn(lat, lng, token)
}

/* ── Confirm a pending auto check-in that needs first-time enrollment ── */
async function confirmPendingEnrollment() {
  if (!pendingConfirm.value) return
  const { lat, lng } = pendingConfirm.value
  enrolling.value = true
  const enrolled = await biometric.enroll()
  enrolling.value = false
  if (!enrolled) {
    toast.error(biometric.error.value || 'Could not set up biometric verification')
    return
  }
  biometricEnrolled.value = true
  toast.success('Biometric verification set up — checking you in now')
  const token = await biometric.verify()
  if (!token) {
    toast.error(biometric.error.value || 'Biometric verification failed')
    return
  }
  pendingConfirm.value = null
  await doAutoCheckIn(lat, lng, token)
}

/* ── GPS ── */
async function detectLocation() {
  if (!navigator.geolocation) { errorMsg.value = 'GPS not available'; return }
  detectingLocation.value = true
  errorMsg.value = ''
  navigator.geolocation.getCurrentPosition(
    pos => {
      currentPosition.value = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }
      detectingLocation.value = false
    },
    () => { detectingLocation.value = false; errorMsg.value = 'Cannot get GPS — enable location permissions.' },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

/* ── Auto GPS watch ── */
function startAutoWatch() {
  if (!navigator.geolocation) return
    // Reduced accuracy and increased maximumAge to save performance and battery
    autoWatchId = navigator.geolocation.watchPosition(
      onAutoGPS,
      err => console.warn('Auto GPS:', err.message),
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 30000 }
    )
}
function stopAutoWatch() {
  if (autoWatchId !== null) { navigator.geolocation.clearWatch(autoWatchId); autoWatchId = null }
  if (autoCheckoutTime) { clearTimeout(autoCheckoutTime); autoCheckoutTime = null }
}

async function onAutoGPS(pos) {
  const lat = pos.coords.latitude, lng = pos.coords.longitude
  currentPosition.value = { lat, lng, accuracy: pos.coords.accuracy }

  const s = schoolSettings.value
  if (!s || !s.gps_enabled || !s.school_lat || !s.school_lng) return

  const dist = calcDist(lat, lng, parseFloat(s.school_lat), parseFloat(s.school_lng))
  const radius = parseInt(s.radius) || 200
  const inside = dist <= radius

  // ── Auto Check-in: first time entering zone with no check-in today ──
  if (inside && !wasInsideZone.value && !props.todayRecord?.check_in) {
    wasInsideZone.value = true
    if (s.biometric_enabled) {
      // Can't complete this silently — WebAuthn requires an explicit tap. Surface
      // a prompt instead; confirmPendingCheckIn() finishes the job once tapped.
      // If this is the employee's first time (not enrolled yet), the same
      // "arrived" banner routes them into enrollBiometric() instead, so their
      // very first check-in is also where their face/fingerprint gets set up.
      pendingConfirm.value = { lat, lng }
      return
    }
    await doAutoCheckIn(lat, lng)
    return
  }

  // ── Auto Check-out: left zone after checking in, after work_end time ──
  if (!inside && wasInsideZone.value === true && props.todayRecord?.check_in && !props.todayRecord?.check_out) {
    wasInsideZone.value = false
    // Schedule checkout after brief delay to avoid false triggers
    if (autoCheckoutTime) clearTimeout(autoCheckoutTime)
    autoCheckoutTime = setTimeout(() => doAutoCheckOut(), 60000) // 1 min debounce
    return
  }

  // Re-entered zone — cancel pending auto checkout
  if (inside && wasInsideZone.value === false) {
    wasInsideZone.value = true
    if (autoCheckoutTime) { clearTimeout(autoCheckoutTime); autoCheckoutTime = null }
  }
}

async function doAutoCheckIn(lat, lng, biometricToken = null) {
  if (loading.value) return
  loading.value = true
  try {
    await api.post('/attendance/checkin', { latitude: lat, longitude: lng, biometric_token: biometricToken })
    gpsVerified.value = true
    toast.success('✅ Auto check-in — you\'re in the school zone!')
    emit('refresh')
  } catch (e) {
    // Silently fail auto check-in (e.g. already checked in)
  } finally { loading.value = false }
}

async function doAutoCheckOut() {
  if (!props.todayRecord?.check_in || props.todayRecord?.check_out) return
  // Only auto-checkout after checkout time configured
  const s = schoolSettings.value
  if (s?.checkout_time) {
    const now = new Date()
    const [ch, cm] = (s.checkout_time || '17:00').split(':').map(Number)
    const checkoutMs = ch * 3600000 + cm * 60000
    const nowMs = now.getHours() * 3600000 + now.getMinutes() * 60000
    if (nowMs < checkoutMs) return // too early — don't auto checkout
  }
  try {
    await api.post('/attendance/checkout')
    toast.success('✅ Auto check-out — you left the school zone')
    emit('refresh')
  } catch {}
}

/* ── Manual Actions ── */
async function checkIn() {
  if (!currentPosition.value) { await detectLocation(); if (!currentPosition.value) return }
  loading.value = true; errorMsg.value = ''
  try {
    let biometricToken = null
    if (schoolSettings.value?.biometric_enabled) {
      if (!biometricEnrolled.value) {
        errorMsg.value = 'Set up biometric verification first (see above) before checking in.'
        toast.error(errorMsg.value)
        return
      }
      biometricToken = await biometric.verify()
      if (!biometricToken) {
        errorMsg.value = biometric.error.value || 'Biometric verification failed'
        toast.error(errorMsg.value)
        return
      }
    }
    await api.post('/attendance/checkin', {
      latitude:  currentPosition.value.lat,
      longitude: currentPosition.value.lng,
      biometric_token: biometricToken,
    })
    gpsVerified.value = true
    toast.success('Checked in successfully!')
    emit('refresh')
  } catch (e) {
    errorMsg.value = e.response?.data?.message || 'Check-in failed — please try again'
    toast.error(errorMsg.value)
  } finally { loading.value = false }
}

async function checkOut() {
  loading.value = true
  try {
    await api.post('/attendance/checkout')
    toast.success('Checked out — have a great evening!')
    emit('refresh')
  } catch (e) {
    toast.error(e.response?.data?.message || 'Check-out failed')
  } finally { loading.value = false }
}

onMounted(async () => {
  if (!isDesktop.value && props.autoWatch) {
    detectLocation()
    await loadSchoolSettings()
    loadBiometricStatus()
    startAutoWatch()
  }
})
onUnmounted(() => {
  stopAutoWatch()
})

// If the viewport crosses the mobile/desktop breakpoint at runtime, hand
// GPS auto-watch duty over to whichever CheckInCard instance is now active.
watch(() => props.autoWatch, async (active) => {
  if (isDesktop.value) return
  if (active) {
    detectLocation()
    if (!schoolSettings.value) await loadSchoolSettings()
    if (biometricEnrolled.value === null) loadBiometricStatus()
    if (autoWatchId === null) startAutoWatch()
  } else {
    stopAutoWatch()
  }
})
</script>

<style scoped>
.checkin-card { padding: 20px; border-radius: var(--radius-lg); }

/* Header */
.card-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; gap:12px; flex-wrap:wrap; }
.teacher-greeting { display:flex; align-items:center; gap:12px; }
.greeting-avatar {
  width:46px; height:46px; border-radius:12px;
  background:linear-gradient(135deg, var(--primary), var(--accent));
  display:flex; align-items:center; justify-content:center;
  color:#fff; font-size:17px; font-weight:800; flex-shrink:0;
  overflow: hidden;
}
.greeting-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.greeting-text { font-size:12px; color:var(--text-muted); }
.teacher-name  { font-size:17px; font-weight:700; line-height:1.2; }
.date-pill {
  display:flex; align-items:center; gap:6px;
  padding:5px 11px; border-radius:99px;
  background:var(--surface); border:1px solid var(--surface-border);
  font-size:12px; color:var(--text-secondary); white-space:nowrap;
}

/* Status panel */
.status-panel {
  display:flex; align-items:center; gap:16px;
  padding:16px 18px; border-radius:var(--radius); margin-bottom:14px;
  border:1.5px solid; transition:all 0.3s;
}
.status-none    { background:rgba(37,99,235,0.06);  border-color:rgba(37,99,235,0.2);  color:var(--primary); }
.status-present { background:rgba(16,185,129,0.07); border-color:rgba(16,185,129,0.25); color:var(--success); }
.status-late    { background:rgba(245,158,11,0.07); border-color:rgba(245,158,11,0.25); color:var(--warning); }
.status-absent  { background:rgba(239,68,68,0.07);  border-color:rgba(239,68,68,0.25);  color:var(--danger);  }
.status-done    { background:rgba(16,185,129,0.07); border-color:rgba(16,185,129,0.25); color:var(--success); }
.status-icon { display:flex; align-items:center; flex-shrink:0; }
.status-label { font-size:17px; font-weight:700; }
.status-times { display:flex; align-items:center; gap:8px; margin-top:5px; flex-wrap:wrap; }
.time-chip { display:flex; align-items:center; gap:4px; font-size:12px; font-weight:600; font-family:var(--mono); }
.time-chip.in  { color:var(--success); }
.time-chip.out { color:var(--warning); }
.time-arrow { color:var(--text-muted); }
.status-hint { font-size:12px; opacity:0.7; margin-top:4px; }

/* Verification */
.verify-row   { display:flex; gap:8px; margin-bottom:14px; }
.verify-badge { flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:8px 12px; border-radius:var(--radius-sm); font-size:12px; font-weight:600; border:1px solid; }
.badge-ok      { background:rgba(16,185,129,0.1);  border-color:rgba(16,185,129,0.25); color:var(--success); }
.badge-ready   { background:rgba(37,99,235,0.08);  border-color:rgba(37,99,235,0.2);  color:var(--primary); }
.badge-fail    { background:rgba(239,68,68,0.07);  border-color:rgba(239,68,68,0.2);  color:var(--danger);  }
.badge-neutral { background:rgba(148,163,184,0.08); border-color:var(--surface-border); color:var(--text-muted); }

/* Actions */
.action-row  { display:flex; gap:10px; }
.action-btn  {
  flex:1; display:flex; align-items:center; justify-content:center; gap:10px;
  padding:15px 20px; border-radius:var(--radius); border:none;
  font-size:16px; font-weight:700; cursor:pointer; font-family:var(--font);
  transition:all 0.22s;
}
.action-btn:disabled { opacity:0.55; cursor:not-allowed; }
.checkin-btn {
  background:linear-gradient(135deg, var(--primary), var(--primary-dark));
  color:#fff; box-shadow:0 6px 20px var(--primary-glow);
}
.checkin-btn:not(:disabled):hover { transform:translateY(-2px); box-shadow:0 10px 28px var(--primary-glow); }
.checkout-btn {
  background:linear-gradient(135deg, var(--warning), #d97706);
  color:#fff; box-shadow:0 6px 18px rgba(245,158,11,0.3);
}
.checkout-btn:not(:disabled):hover { transform:translateY(-2px); }
.day-done {
  flex:1; display:flex; align-items:center; justify-content:center; gap:8px;
  padding:15px; border-radius:var(--radius);
  background:rgba(16,185,129,0.08); border:1.5px solid rgba(16,185,129,0.2);
  color:var(--success); font-size:13px; font-weight:600;
}
.refresh-btn {
  width:52px; height:52px; flex-shrink:0; border-radius:var(--radius);
  border:1.5px solid var(--surface-border); background:var(--surface);
  color:var(--text-muted); display:flex; align-items:center; justify-content:center;
  cursor:pointer; transition:all 0.2s;
}
.refresh-btn:hover { border-color:var(--primary); color:var(--primary); }
.refresh-btn:disabled { opacity:0.5; }
.action-spinner {
  width:20px; height:20px; border:2.5px solid rgba(255,255,255,0.3);
  border-top-color:#fff; border-radius:50%; animation:spin 0.8s linear infinite;
}
.spinning { animation:spin 1s linear infinite; }

/* Error */
.error-msg { display:flex; align-items:center; gap:8px; margin-top:12px; padding:10px 13px; border-radius:var(--radius-sm); background:rgba(239,68,68,0.07); border:1px solid rgba(239,68,68,0.2); color:var(--danger); font-size:13px; }

/* Biometric banners */
.biometric-banner {
  display:flex; align-items:center; gap:10px; margin-bottom:14px;
  padding:12px 14px; border-radius:var(--radius); border:1.5px solid rgba(37,99,235,0.2);
  background:rgba(37,99,235,0.06);
}
.biometric-banner-warn   { border-color:rgba(245,158,11,0.25); background:rgba(245,158,11,0.07); }
.biometric-banner-active { border-color:rgba(16,185,129,0.25); background:rgba(16,185,129,0.08); }
.biometric-banner-text  { flex:1; min-width:0; }
.biometric-banner-title { font-size:13px; font-weight:700; }
.biometric-banner-sub   { font-size:11.5px; color:var(--text-muted); margin-top:2px; line-height:1.4; }
.btn-spinner-sm {
  width:14px; height:14px; border:2px solid rgba(255,255,255,0.35);
  border-top-color:#fff; border-radius:50%; animation:spin 0.8s linear infinite; flex-shrink:0;
}

/* Desktop notice */
.desktop-checkin-notice {
  display:flex; align-items:flex-start; gap:8px; margin-top:12px;
  padding:11px 14px; border-radius:var(--radius-sm);
  background:rgba(37,99,235,0.07); border:1px solid rgba(37,99,235,0.2);
  color:var(--primary); font-size:13px; line-height:1.5; font-weight:500;
}

@keyframes spin { to { transform:rotate(360deg); } }
</style>
