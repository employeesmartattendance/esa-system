<template>
  <div class="settings-page">

    <!-- Page header (always visible) -->
    <div class="settings-page-header">
      <div>
        <h2 class="page-title">Attendance Settings</h2>
        <p class="page-desc">Configure Wi-Fi validation, check-in windows, allowed days, and automatic checkout rules</p>
      </div>
      <button class="btn btn-primary" @click="saveSettings" :disabled="saving">
        <span v-if="saving" class="btn-spinner"></span>
        <AppIcon v-else name="check" :size="16" />
        {{ saving ? 'Saving...' : 'Save All Settings' }}
      </button>
    </div>

    <!-- Status alert -->
    <div v-if="saved" class="save-alert">
      <AppIcon name="check-circle" :size="16" color="var(--success)" />
      Settings saved successfully · Active for all teachers
    </div>

    <div class="settings-layout">

      <!-- ── LEFT COLUMN ── -->
      <div class="settings-col">

        <!-- GPS Card: full on web, inline notice on desktop -->

        <!-- Desktop: GPS inline notice -->
        <div v-if="isDesktop" class="glass settings-card">
          <div class="card-head">
            <div class="card-icon-wrap" style="background:rgba(245,158,11,0.12)">
              <AppIcon name="location" :size="20" color="var(--warning)" />
            </div>
            <div class="card-head-text">
              <div class="card-title">GPS Geofencing</div>
              <div class="card-desc">Not available on desktop — use mobile or web app</div>
            </div>
            <span class="gps-unavailable-badge">Desktop</span>
          </div>
          <div class="card-body">
            <div class="info-box" style="background:rgba(245,158,11,0.06);border-color:rgba(245,158,11,0.2)">
              <AppIcon name="info" :size="13" color="var(--warning)" />
              <span>GPS location features require hardware GPS that is only available on mobile devices. All other attendance settings below are fully functional.</span>
            </div>
          </div>
        </div>

        <!-- Web/Mobile: full GPS card -->
        <div v-else class="glass settings-card">
          <div class="card-head">
            <div class="card-icon-wrap" style="background:rgba(37,99,235,0.12)">
              <AppIcon name="location" :size="20" color="var(--primary)" />
            </div>
            <div class="card-head-text">
              <div class="card-title">GPS Geofencing</div>
              <div class="card-desc">Teachers must be within the radius to check in</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="form.gps_enabled" />
              <span class="toggle-track"></span>
            </label>
          </div>

          <div class="card-body" :class="{ 'card-disabled': !form.gps_enabled }">
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">School Latitude</label>
                <input v-model="form.school_lat" type="number" step="0.000001" class="form-input mono-font" placeholder="-1.9441" />
              </div>
              <div class="form-group">
                <label class="form-label">School Longitude</label>
                <input v-model="form.school_lng" type="number" step="0.000001" class="form-input mono-font" placeholder="30.0619" />
              </div>
            </div>

            <!-- Radius slider -->
            <div class="form-group">
              <div class="radius-header">
                <label class="form-label">Allowed Radius</label>
                <span class="radius-badge">{{ form.radius }}m</span>
              </div>
              <input v-model="form.radius" type="range" min="10" max="1000" step="10" class="range-slider" />
              <div class="range-marks"><span>10m (strict)</span><span>500m</span><span>1km (loose)</span></div>
            </div>

            <!-- Radius visual indicator -->
            <div class="radius-visual">
              <div class="radius-ring" :style="`transform: scale(${radiusScale})`"></div>
              <div class="radius-dot"></div>
              <div class="radius-label-vis">{{ form.radius }}m radius</div>
            </div>

            <button class="btn btn-ghost btn-sm full-w" @click="detectLocation" :disabled="detectingGPS">
              <span v-if="detectingGPS" class="btn-spinner-xs"></span>
              <AppIcon v-else name="location" :size="14" />
              {{ detectingGPS ? 'Detecting your location...' : 'Use My Current Location as School' }}
            </button>
          </div>
        </div><!-- end GPS card -->

        <div class="glass settings-card">
          <div class="card-head">
            <div class="card-icon-wrap" style="background:rgba(6,182,212,0.12)">
              <AppIcon name="wifi" :size="20" color="var(--accent)" />
            </div>
            <div class="card-head-text">
              <div class="card-title">Wi-Fi Validation</div>
              <div class="card-desc">Require school network connection to check in</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="form.wifi_enabled" />
              <span class="toggle-track"></span>
            </label>
          </div>

          <div class="card-body" :class="{ 'card-disabled': !form.wifi_enabled }">
            <div class="form-group">
              <label class="form-label">Allowed Network BSSID(s)</label>
              <textarea
                v-model="form.wifi_bssid"
                class="form-input mono-font"
                rows="3"
                placeholder="AA:BB:CC:DD:EE:FF&#10;Enter one BSSID per line (router MAC address)"
                style="resize:vertical"
              ></textarea>
            </div>
            <div class="info-box">
              <AppIcon name="info" :size="13" color="var(--primary)" />
              <span>Find your router's BSSID in network settings. Teachers must be on this Wi-Fi to check in.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── RIGHT COLUMN ── -->
      <div class="settings-col">

        <!-- Attendance Time Windows Card -->
        <div class="glass settings-card">
          <div class="card-head">
            <div class="card-icon-wrap" style="background:rgba(245,158,11,0.12)">
              <AppIcon name="clock" :size="20" color="var(--warning)" />
            </div>
            <div class="card-head-text">
              <div class="card-title">Check-In Time Rules</div>
              <div class="card-desc">Define the windows for present, late and absent</div>
            </div>
          </div>

          <div class="card-body">
            <!-- Visual timeline -->
            <div class="time-timeline">
              <div class="timeline-label">Daily Check-In Timeline</div>
              <div class="timeline-bar">
                <div class="tl-segment open"   :style="openWidth">
                  <span class="tl-seg-label">Early</span>
                </div>
                <div class="tl-segment present" :style="presentWidth">
                  <span class="tl-seg-label">Present</span>
                </div>
                <div class="tl-segment late"    :style="lateWidth">
                  <span class="tl-seg-label">Late</span>
                </div>
                <div class="tl-segment absent"  style="flex:1">
                  <span class="tl-seg-label">Absent</span>
                </div>
              </div>
              <div class="timeline-times">
                <span>{{ fmt(form.checkin_start) }}</span>
                <span>{{ fmt(form.late_threshold) }}</span>
                <span>{{ fmt(form.absent_threshold) }}</span>
              </div>
            </div>

            <div class="time-rules-grid">
              <!-- Check-in open from -->
              <div class="time-rule-card open">
                <div class="trc-header">
                  <div class="trc-dot open"></div>
                  <div class="trc-title">Check-In Opens</div>
                </div>
                <input v-model="form.checkin_start" type="time" class="form-input mono-font time-input" />
                <div class="trc-desc">Earliest allowed check-in time</div>
              </div>

              <!-- Present threshold -->
              <div class="time-rule-card present">
                <div class="trc-header">
                  <div class="trc-dot present"></div>
                  <div class="trc-title">On-Time Deadline</div>
                </div>
                <input v-model="form.late_threshold" type="time" class="form-input mono-font time-input" />
                <div class="trc-desc">Before this = Present</div>
              </div>

              <!-- Late threshold -->
              <div class="time-rule-card late">
                <div class="trc-header">
                  <div class="trc-dot late"></div>
                  <div class="trc-title">Late Deadline</div>
                </div>
                <input v-model="form.absent_threshold" type="time" class="form-input mono-font time-input" />
                <div class="trc-desc">Before this = Late · After = Absent</div>
              </div>
            </div>

            <div class="time-legend">
              <div class="tl-item"><span class="tl-dot open"></span>{{ fmt(form.checkin_start) }} — Check-in opens</div>
              <div class="tl-item"><span class="tl-dot present"></span>Until {{ fmt(form.late_threshold) }} — Present</div>
              <div class="tl-item"><span class="tl-dot late"></span>{{ fmt(form.late_threshold) }} – {{ fmt(form.absent_threshold) }} — Late</div>
              <div class="tl-item"><span class="tl-dot absent"></span>After {{ fmt(form.absent_threshold) }} — Absent</div>
            </div>
          </div>
        </div>

        <!-- Attendance Days Card -->
        <div class="glass settings-card">
          <div class="card-head">
            <div class="card-icon-wrap" style="background:rgba(37,99,235,0.12)">
              <AppIcon name="calendar" :size="20" color="var(--primary)" />
            </div>
            <div class="card-head-text">
              <div class="card-title">Allowed Attendance Days</div>
              <div class="card-desc">Only these days will count for attendance tracking</div>
            </div>
          </div>
          <div class="card-body">
            <div class="days-grid">
              <button
                v-for="(label, i) in DAY_LABELS"
                :key="i"
                type="button"
                class="day-btn"
                :class="{ active: form.allowed_days.includes(i) }"
                @click="toggleDay(i)"
              >
                {{ label }}
              </button>
            </div>
            <div class="info-box" style="margin-top:4px">
              <AppIcon name="info" :size="13" color="var(--primary)" />
              <span>Check-ins on <strong>unselected days</strong> will be blocked. Default is Mon–Fri.</span>
            </div>
          </div>
        </div>

        <!-- Auto Check-Out Card -->
        <div class="glass settings-card">
          <div class="card-head">
            <div class="card-icon-wrap" style="background:rgba(16,185,129,0.12)">
              <AppIcon name="checkout" :size="20" color="var(--success)" />
            </div>
            <div class="card-head-text">
              <div class="card-title">Automatic Check-Out</div>
              <div class="card-desc">Auto-close attendance at end of school day</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" v-model="form.auto_checkout_enabled" />
              <span class="toggle-track"></span>
            </label>
          </div>

          <div class="card-body" :class="{ 'card-disabled': !form.auto_checkout_enabled }">
            <div class="form-group">
              <label class="form-label">School Day End Time</label>
              <input v-model="form.checkout_time" type="time" class="form-input mono-font" />
              <p class="field-hint">All teachers still checked in will be automatically checked out at this time</p>
            </div>

            <!-- How it works -->
            <div class="how-it-works">
              <div class="hiw-title"><AppIcon name="info" :size="13" color="var(--primary)" />How Auto Check-Out Works</div>
              <div class="hiw-steps">
                <div class="hiw-step">
                  <div class="step-num">1</div>
                  <span>At <strong>{{ fmt(form.checkout_time) }}</strong>, the system scans for teachers still checked in</span>
                </div>
                <div class="hiw-step">
                  <div class="step-num">2</div>
                  <span>All open sessions are automatically closed with a system note</span>
                </div>
                <div class="hiw-step">
                  <div class="step-num">3</div>
                  <span v-if="form.notify_admin_checkout">You receive a real-time notification with the list of auto-checked-out teachers</span>
                  <span v-else>Notifications are disabled — toggle below to enable</span>
                </div>
              </div>
            </div>

            <!-- Notify admin toggle -->
            <div class="notif-toggle-row">
              <div class="notif-toggle-info">
                <AppIcon name="bell" :size="15" color="var(--primary)" />
                <div>
                  <div class="notif-toggle-label">Admin Notification</div>
                  <div class="notif-toggle-desc">Receive alert when auto check-out runs</div>
                </div>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="form.notify_admin_checkout" />
                <span class="toggle-track"></span>
              </label>
            </div>

            <!-- Manual trigger button -->
            <div class="manual-checkout-section">
              <div class="manual-label">Manual Trigger</div>
              <button class="btn btn-ghost btn-sm full-w" @click="triggerManualCheckout" :disabled="triggering">
                <span v-if="triggering" class="btn-spinner-xs"></span>
                <AppIcon v-else name="checkout" :size="14" />
                {{ triggering ? 'Processing...' : 'Checkout All Currently Checked-In Teachers Now' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Live Summary Card -->
        <div class="glass settings-card summary-card">
          <div class="card-head">
            <div class="card-icon-wrap" style="background:rgba(139,92,246,0.12)">
              <AppIcon name="analytics" :size="20" color="var(--info)" />
            </div>
            <div class="card-head-text">
              <div class="card-title">Active Configuration</div>
              <div class="card-desc">Current settings at a glance</div>
            </div>
            <button class="btn btn-ghost btn-sm" @click="loadSettings">
              <AppIcon name="refresh" :size="13" />
            </button>
          </div>

          <div class="card-body">
            <div class="config-grid">
              <div class="config-chip" :class="form.gps_enabled ? 'chip-on' : 'chip-off'">
                <AppIcon name="location" :size="14" />
                GPS {{ form.gps_enabled ? 'ON' : 'OFF' }}
                <span v-if="form.gps_enabled" class="chip-sub">{{ form.radius }}m radius</span>
              </div>
              <div class="config-chip" :class="form.wifi_enabled ? 'chip-on' : 'chip-off'">
                <AppIcon name="wifi" :size="14" />
                Wi-Fi {{ form.wifi_enabled ? 'ON' : 'OFF' }}
              </div>
              <div class="config-chip chip-time">
                <AppIcon name="check-circle" :size="14" color="var(--success)" />
                Present by {{ fmt(form.late_threshold) }}
              </div>
              <div class="config-chip chip-time">
                <AppIcon name="clock" :size="14" color="var(--warning)" />
                Late until {{ fmt(form.absent_threshold) }}
              </div>
              <div class="config-chip" :class="form.auto_checkout_enabled ? 'chip-on' : 'chip-off'">
                <AppIcon name="checkout" :size="14" />
                Auto-out {{ form.auto_checkout_enabled ? fmt(form.checkout_time) : 'OFF' }}
              </div>
              <div class="config-chip chip-time">
                <AppIcon name="clock" :size="14" color="var(--primary)" />
                Opens {{ fmt(form.checkin_start) }}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div><!-- end settings-layout -->
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import { useToast } from '../../composables/useToast'
import api from '../../api'

defineProps({ schoolId: [Number, String] })
const toast = useToast()

// ── Desktop detection ──────────────────────────────────────────────────────
const isDesktop = ref(typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron'))
const WEB_URL   = typeof window !== 'undefined' ? (import.meta.env?.VITE_WEBSITE_URL || window.location.origin) : ''

const saving        = ref(false)
const detectingGPS  = ref(false)
const triggering    = ref(false)
const saved         = ref(false)

const form = ref({
  gps_enabled:            true,
  wifi_enabled:           false,
  school_lat:             '',
  school_lng:             '',
  radius:                 200,
  wifi_bssid:             '',
  checkin_start:          '06:00',
  late_threshold:         '08:00',
  absent_threshold:       '09:00',
  checkout_time:          '17:00',
  auto_checkout_enabled:  true,
  notify_admin_checkout:  true,
  allowed_days:           [1, 2, 3, 4, 5],  // Mon-Fri by default
})

// ── Helpers ──────────────────────────────────────────────────────────────
function fmt(t) {
  if (!t) return '--:--'
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12  = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

const radiusScale = computed(() => Math.min(Math.max(form.value.radius / 500, 0.3), 1))

// Compute timeline bar widths (simple proportional)
const totalWindow = computed(() => {
  const toMins = t => { if (!t) return 0; const [h,m]=t.split(':').map(Number); return h*60+m }
  const open   = toMins(form.value.checkin_start)
  const late   = toMins(form.value.late_threshold)
  const absent = toMins(form.value.absent_threshold)
  const end    = absent + 120   // 2h past absent = 100%
  const total  = end - open
  return { open, late, absent, end, total }
})
const openWidth    = computed(() => {
  const w = (form.value.checkin_start && form.value.late_threshold) ? 0 : 0
  return `flex:0`
})
const presentWidth = computed(() => {
  const w = totalWindow.value
  if (!w.total) return `flex:1`
  return `flex:${((w.late - w.open) / w.total).toFixed(2)}`
})
const lateWidth = computed(() => {
  const w = totalWindow.value
  if (!w.total) return `flex:1`
  return `flex:${((w.absent - w.late) / w.total).toFixed(2)}`
})

// ── Data ─────────────────────────────────────────────────────────────────
async function loadSettings() {
  try {
    const r = await api.get('/settings')
    const d = (r && typeof r === 'object') ? r : {}
    Object.assign(form.value, {
      ...d,
      gps_enabled:  Boolean(d.gps_enabled  != null ? d.gps_enabled  : true),
      wifi_enabled: Boolean(d.wifi_enabled != null ? d.wifi_enabled : false),
      checkin_start:         stripSeconds(d.checkin_start)   || '06:00',
      late_threshold:        stripSeconds(d.late_threshold)  || '08:00',
      absent_threshold:      stripSeconds(d.absent_threshold) || '09:00',
      checkout_time:         stripSeconds(d.checkout_time)   || '17:00',
      auto_checkout_enabled: Boolean(d.auto_checkout_enabled ?? true),
      notify_admin_checkout: Boolean(d.notify_admin_checkout ?? true),
      allowed_days:          Array.isArray(d.allowed_days) && d.allowed_days.length ? d.allowed_days : [1,2,3,4,5],
    })
  } catch {}
}

function stripSeconds(t) {
  if (!t) return ''
  return t.substring(0, 5)
}

async function saveSettings() {
  saving.value = true
  saved.value  = false
  try {
    await api.post('/settings', form.value)
    saved.value = true
    toast.success('Settings saved · Changes take effect immediately')
    setTimeout(() => { saved.value = false }, 5000)
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed to save settings')
  } finally { saving.value = false }
}

function detectLocation() {
  if (!navigator.geolocation) { toast.error('GPS not available in this browser'); return }
  detectingGPS.value = true
  navigator.geolocation.getCurrentPosition(
    pos => {
      form.value.school_lat = pos.coords.latitude.toFixed(7)
      form.value.school_lng = pos.coords.longitude.toFixed(7)
      detectingGPS.value    = false
      toast.success(`Location detected: ${form.value.school_lat}, ${form.value.school_lng}`)
    },
    err => {
      detectingGPS.value = false
      toast.error('Could not detect location — check browser permissions')
    },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

async function triggerManualCheckout() {
  triggering.value = true
  try {
    const r = await api.post('/school/auto-checkout/trigger')
    const d = (r && typeof r === 'object') ? r : {}
    if (d.count === 0) {
      toast.info('No teachers currently checked in — nothing to do')
    } else {
      toast.success(`${d.count} teacher(s) checked out: ${d.teachers?.join(', ')}`)
    }
  } catch (e) {
    toast.error(e.response?.data?.message || 'Trigger failed')
  } finally { triggering.value = false }
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function toggleDay(d) {
  const idx = form.value.allowed_days.indexOf(d)
  if (idx === -1) form.value.allowed_days = [...form.value.allowed_days, d].sort((a,b) => a-b)
  else form.value.allowed_days = form.value.allowed_days.filter(x => x !== d)
}

onMounted(loadSettings)
</script>

<style scoped>
/* ── Page ── */
.settings-page { max-width: 100%; overflow-x: hidden; box-sizing: border-box; }
.settings-page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:20px; gap:12px; flex-wrap:wrap; max-width:100%; box-sizing:border-box; }
.page-title { font-size:22px; font-weight:800; }
.page-desc  { font-size:13px; color:var(--text-muted); margin-top:4px; max-width:520px; }
.save-alert { display:flex; align-items:center; gap:10px; padding:12px 16px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); border-radius:var(--radius-sm); font-size:13px; font-weight:600; color:var(--success); margin-bottom:20px; animation:fadeIn 0.3s ease; }
.gps-unavailable-badge { padding:4px 10px; border-radius:99px; background:rgba(245,158,11,0.12); color:var(--warning); font-size:11px; font-weight:700; border:1px solid rgba(245,158,11,0.25); white-space:nowrap; }


/* ── Layout ── */
.settings-layout { display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start; max-width:100%; box-sizing:border-box; }
.settings-col    { display:flex; flex-direction:column; gap:16px; min-width:0; overflow:hidden; }

/* ── Card ── */
.settings-card { padding:0; border-radius:var(--radius-lg); overflow:hidden; max-width:100%; box-sizing:border-box; }
.card-head {
  display:flex; align-items:center; gap:14px;
  padding:18px 20px 16px;
  border-bottom:1px solid var(--surface-border);
  min-width:0;
}
.card-icon-wrap { width:44px; height:44px; border-radius:var(--radius); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.card-head-text { flex:1; min-width:0; }
.card-title { font-size:14px; font-weight:700; }
.card-desc  { font-size:12px; color:var(--text-muted); margin-top:2px; }
.card-body  { padding:18px 20px; display:flex; flex-direction:column; gap:14px; }
.card-disabled { opacity:0.38; pointer-events:none; }

/* ── Toggle ── */
.toggle-switch { position:relative; width:44px; height:24px; flex-shrink:0; cursor:pointer; display:block; }
.toggle-switch input { opacity:0; width:0; height:0; }
.toggle-track { position:absolute; inset:0; background:var(--surface-border); border-radius:99px; transition:all 0.25s; }
.toggle-switch input:checked + .toggle-track { background:var(--primary); }
.toggle-track::after { content:''; position:absolute; left:3px; top:3px; width:18px; height:18px; border-radius:50%; background:#fff; transition:transform 0.25s; }
.toggle-switch input:checked + .toggle-track::after { transform:translateX(20px); }

/* ── Form ── */
.form-row-2  { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.form-group  { display:flex; flex-direction:column; gap:6px; }
.form-label  { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-secondary); }
.form-input  { padding:10px 12px; background:var(--surface); border:1.5px solid var(--surface-border); border-radius:var(--radius-sm); color:var(--text); font-size:14px; font-family:var(--font); width:100%; transition:all 0.2s; box-sizing:border-box; max-width:100%; }
.form-input:focus { outline:none; border-color:var(--primary); box-shadow:0 0 0 3px var(--primary-glow); }
.mono-font { font-family:var(--mono); }
.time-input { font-size:18px; font-weight:700; text-align:center; padding:12px; }
.field-hint { font-size:12px; color:var(--text-muted); margin-top:2px; }
.full-w { width:100%; justify-content:center; }

/* ── Radius ── */
.radius-header { display:flex; align-items:center; justify-content:space-between; }
.radius-badge  { background:rgba(37,99,235,0.12); color:var(--primary); font-size:12px; font-weight:700; padding:2px 8px; border-radius:99px; font-family:var(--mono); }
.range-slider  { width:100%; accent-color:var(--primary); }
.range-marks   { display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:-6px; }
.radius-visual {
  position:relative; height:80px; display:flex; align-items:center; justify-content:center;
  background:rgba(37,99,235,0.04); border:1px solid var(--surface-border); border-radius:var(--radius-sm);
}
.radius-ring {
  position:absolute; width:60px; height:60px; border-radius:50%;
  border:2px solid rgba(37,99,235,0.4); background:rgba(37,99,235,0.08);
  transition:transform 0.4s ease;
}
.radius-dot {
  position:absolute; width:10px; height:10px; border-radius:50%;
  background:var(--primary); box-shadow:0 0 8px var(--primary-glow); z-index:2;
}
.radius-label-vis { position:absolute; bottom:6px; font-size:11px; color:var(--text-muted); font-family:var(--mono); }

/* ── Wi-Fi ── */
.info-box { display:flex; align-items:flex-start; gap:8px; padding:10px 12px; background:rgba(37,99,235,0.05); border:1px solid rgba(37,99,235,0.1); border-radius:var(--radius-sm); font-size:12px; color:var(--text-secondary); line-height:1.5; }

/* ── Time timeline ── */
.time-timeline { margin-bottom:4px; }
.timeline-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); margin-bottom:8px; }
.timeline-bar { display:flex; height:28px; border-radius:var(--radius-sm); overflow:hidden; gap:1px; }
.tl-segment { display:flex; align-items:center; justify-content:center; min-width:20px; }
.tl-segment.open    { background:rgba(139,92,246,0.2); }
.tl-segment.present { background:rgba(16,185,129,0.25); }
.tl-segment.late    { background:rgba(245,158,11,0.25); }
.tl-segment.absent  { background:rgba(239,68,68,0.2); }
.tl-seg-label { font-size:10px; font-weight:700; color:var(--text-secondary); }
.timeline-times { display:flex; justify-content:space-between; font-size:10px; color:var(--text-muted); margin-top:4px; font-family:var(--mono); }

/* ── Time rules ── */
.time-rules-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
.time-rule-card  { padding:12px; border-radius:var(--radius-sm); border:1.5px solid var(--surface-border); background:var(--surface); text-align:center; }
.time-rule-card.open    { border-color:rgba(139,92,246,0.3); }
.time-rule-card.present { border-color:rgba(16,185,129,0.3); }
.time-rule-card.late    { border-color:rgba(245,158,11,0.3); }
.trc-header { display:flex; align-items:center; justify-content:center; gap:5px; margin-bottom:8px; }
.trc-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.trc-dot.open    { background:#8b5cf6; }
.trc-dot.present { background:#10b981; }
.trc-dot.late    { background:#f59e0b; }
.trc-title { font-size:11px; font-weight:700; }
.trc-desc  { font-size:10px; color:var(--text-muted); margin-top:6px; line-height:1.4; }
.time-legend { display:flex; flex-direction:column; gap:5px; }
.tl-item { display:flex; align-items:center; gap:7px; font-size:12px; color:var(--text-secondary); }
.tl-dot  { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.tl-dot.open    { background:#8b5cf6; }
.tl-dot.present { background:#10b981; }
.tl-dot.late    { background:#f59e0b; }
.tl-dot.absent  { background:#ef4444; }

/* ── Auto checkout ── */
.how-it-works { background:rgba(37,99,235,0.04); border:1px solid var(--surface-border); border-radius:var(--radius-sm); padding:14px; }
.hiw-title { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; margin-bottom:10px; color:var(--primary); }
.hiw-steps { display:flex; flex-direction:column; gap:8px; }
.hiw-step  { display:flex; align-items:flex-start; gap:10px; font-size:12px; color:var(--text-secondary); line-height:1.5; }
.step-num  { width:20px; height:20px; border-radius:50%; background:rgba(37,99,235,0.12); color:var(--primary); font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.notif-toggle-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; background:var(--surface); border:1px solid var(--surface-border); border-radius:var(--radius-sm); }
.notif-toggle-info { display:flex; align-items:center; gap:10px; }
.notif-toggle-label { font-size:13px; font-weight:600; }
.notif-toggle-desc  { font-size:11px; color:var(--text-muted); margin-top:1px; }
.manual-checkout-section { border-top:1px solid var(--surface-border); padding-top:14px; }
.manual-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); margin-bottom:8px; }

/* ── Summary ── */
.config-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; max-width:100%; box-sizing:border-box; }
.config-chip {
  display:flex; align-items:center; gap:7px; flex-wrap:wrap;
  padding:9px 12px; border-radius:var(--radius-sm);
  font-size:12px; font-weight:700;
  border:1px solid var(--surface-border); background:var(--surface);
}
.config-chip.chip-on   { background:rgba(16,185,129,0.08); border-color:rgba(16,185,129,0.2); color:#10b981; }
.config-chip.chip-off  { background:rgba(239,68,68,0.06);  border-color:rgba(239,68,68,0.15); color:#ef4444; }
.config-chip.chip-time { background:rgba(37,99,235,0.06);  border-color:rgba(37,99,235,0.15); color:var(--primary); }
.chip-sub { font-size:10px; font-weight:500; opacity:0.7; }

/* ── Misc ── */
.btn-spinner    { width:14px; height:14px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.8s linear infinite; }
.btn-spinner-xs { width:12px; height:12px; border:2px solid var(--surface-border); border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite; }
@keyframes spin    { to { transform:rotate(360deg); } }
@keyframes fadeIn  { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }

/* ── Desktop GPS Notice ── */
.desktop-gps-notice {
  display:flex; gap:20px; align-items:flex-start;
  padding:28px 28px; border-radius:var(--radius-lg);
  background:rgba(37,99,235,0.07); border:1.5px solid rgba(37,99,235,0.2);
  margin:24px 0;
}
.dgn-icon { font-size:36px; flex-shrink:0; }
.dgn-body { flex:1; }
.dgn-title { font-size:18px; font-weight:800; color:var(--primary); margin-bottom:10px; }
.dgn-desc  { font-size:14px; color:var(--text-secondary); line-height:1.7; margin-bottom:18px; }
.dgn-actions { display:flex; gap:10px; flex-wrap:wrap; }
.dgn-btn {
  display:inline-flex; align-items:center; gap:7px;
  padding:9px 20px; border-radius:var(--radius-sm);
  border:1.5px solid var(--primary); background:var(--primary);
  color:#fff; font-size:13px; font-weight:700; cursor:pointer;
  transition:all 0.2s; text-decoration:none;
}
.dgn-btn:hover { background:var(--primary-dark); }

@media (max-width:1100px) { .settings-layout { grid-template-columns:1fr; } }
@media (max-width:768px)  {
  .settings-page { padding: 0 0px; }
  .settings-page-header { flex-direction: column; align-items: flex-start; gap: 12px; padding: 0 2px; }
  .settings-page-header .btn { width: 100%; justify-content: center; }
  .settings-layout { gap: 12px; }
  .card-body { padding: 14px 14px; }
  .card-head { padding: 14px 14px 12px; }
  .summary-card .config-grid { grid-template-columns: 1fr; }
}
@media (max-width:600px)  { .form-row-2 { grid-template-columns:1fr; } .time-rules-grid { grid-template-columns:1fr; } .config-grid { grid-template-columns:1fr; } }

/* ── Attendance Days ── */
.days-grid {
  display: grid; grid-template-columns: repeat(7,1fr); gap:8px;
}
.day-btn {
  padding:10px 4px; border-radius:var(--radius-sm); border:1.5px solid var(--surface-border);
  background:var(--surface); color:var(--text-muted); font-size:12px; font-weight:700;
  cursor:pointer; transition:all 0.2s; font-family:var(--font); text-align:center;
}
.day-btn:hover { border-color:var(--primary); color:var(--primary); background:rgba(37,99,235,0.06); }
.day-btn.active { background:linear-gradient(135deg,var(--primary),var(--primary-dark)); color:#fff; border-color:var(--primary); box-shadow:0 3px 10px var(--primary-glow); }

</style>
