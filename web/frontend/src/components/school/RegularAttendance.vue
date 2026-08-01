<template>
  <div class="reg-att-page">

    <!-- Page header -->
    <div class="reg-att-header">
      <div>
        <h2 class="page-title">Regular Attendance</h2>
        <p class="page-desc">Instantly record attendance for {{ vocab.personNounPlural.toLowerCase() }} currently in range — done quietly, only you see this</p>
      </div>
    </div>

    <!-- Private notice -->
    <div class="privacy-note">
      <AppIcon name="shield" :size="15" color="var(--primary)" />
      <span>This action is silent — {{ vocab.personNounPlural.toLowerCase() }} are never notified when you record attendance here.</span>
    </div>

    <!-- Zone picker card -->
    <div class="glass zone-card">
      <div class="card-head">
        <div class="card-icon-wrap" style="background:rgba(37,99,235,0.12)">
          <AppIcon name="location" :size="20" color="var(--primary)" />
        </div>
        <div class="card-head-text">
          <div class="card-title">Zone Location</div>
          <div class="card-desc">Choose which location to scan for nearby {{ vocab.personNounPlural.toLowerCase() }}</div>
        </div>
      </div>

      <div class="card-body">
        <!-- Zone source toggle -->
        <div class="zone-source-toggle">
          <button
            type="button"
            class="zone-src-btn"
            :class="{ active: zoneSource === 'company' }"
            @click="selectCompanyZone"
          >
            <AppIcon name="building" :size="16" />
            <span>{{ vocab.orgNoun }} Location</span>
          </button>
          <button
            type="button"
            class="zone-src-btn"
            :class="{ active: zoneSource === 'current' }"
            @click="selectCurrentZone"
          >
            <AppIcon name="location" :size="16" />
            <span>My Current Location</span>
          </button>
        </div>

        <div v-if="zoneSource === 'current'" class="current-loc-row">
          <button class="btn btn-ghost btn-sm full-w" @click="detectCurrentLocation" :disabled="detectingGPS">
            <span v-if="detectingGPS" class="btn-spinner-xs"></span>
            <AppIcon v-else name="location" :size="14" />
            {{ detectingGPS ? 'Detecting your location...' : 'Refresh My Location' }}
          </button>
          <p v-if="currentGpsAccuracy" class="gps-accuracy-hint">±{{ Math.round(currentGpsAccuracy) }}m accuracy</p>
        </div>

        <div class="zone-coords-row">
          <div class="zc-item">
            <span class="zc-label">Latitude</span>
            <span class="zc-val mono-font">{{ center.lat != null ? center.lat.toFixed(6) : '—' }}</span>
          </div>
          <div class="zc-item">
            <span class="zc-label">Longitude</span>
            <span class="zc-val mono-font">{{ center.lng != null ? center.lng.toFixed(6) : '—' }}</span>
          </div>
        </div>

        <!-- Radius -->
        <div class="form-group">
          <div class="radius-header">
            <label class="form-label">Scan Radius</label>
            <span class="radius-badge">{{ radius }}m</span>
          </div>
          <input v-model.number="radius" type="range" min="10" max="1000" step="10" class="range-slider" />
          <div class="range-marks"><span>10m</span><span>500m</span><span>1km</span></div>
        </div>

        <button class="btn btn-primary full-w" @click="scanZone" :disabled="scanning || center.lat == null">
          <span v-if="scanning" class="btn-spinner"></span>
          <AppIcon v-else name="search" :size="16" />
          {{ scanning ? 'Scanning...' : `Scan for ${vocab.personNounPlural}` }}
        </button>
      </div>
    </div>

    <!-- Results -->
    <div v-if="scanned" class="glass results-card">
      <div class="results-header">
        <div class="results-header-text">
          <div class="card-title">Nearby {{ vocab.personNounPlural }}</div>
          <div class="card-desc">{{ inZoneCount }} in zone · {{ employees.length }} total {{ vocab.personNounPlural.toLowerCase() }}</div>
        </div>
        <button class="icon-btn" title="Rescan" @click="scanZone" :disabled="scanning">
          <AppIcon name="refresh" :size="15" :class="{ spinning: scanning }" />
        </button>
      </div>

      <div v-if="!employees.length" class="empty-wrap">
        <EmptyState icon="teachers" title="No employees found" message="Add employees to your team to scan for them here." />
      </div>

      <template v-else>
        <!-- Select-all row -->
        <div class="select-all-row">
          <label class="check-row">
            <input type="checkbox" :checked="allSelectableChecked" @change="toggleSelectAll" />
            <span>Select all in-zone, unmarked</span>
          </label>
          <span class="selected-count" v-if="selectedIds.size">{{ selectedIds.size }} selected</span>
        </div>

        <!-- Employee list -->
        <div class="employee-list">
          <div
            v-for="e in employees"
            :key="e.teacher_id"
            class="employee-row"
            :class="{ 'in-zone': e.in_zone, 'already-marked': e.already_marked, 'no-loc': !e.has_location }"
          >
            <label class="check-row emp-check">
              <input
                type="checkbox"
                :disabled="e.already_marked || !e.in_zone"
                :checked="selectedIds.has(e.teacher_id)"
                @change="toggleSelect(e.teacher_id)"
              />
            </label>

            <div class="emp-avatar">
              <img v-if="resolveAvatar(e.avatar)" :src="resolveAvatar(e.avatar)" :alt="e.name" class="emp-avatar-img" />
              <span v-else>{{ (e.name || '?').charAt(0) }}</span>
            </div>

            <div class="emp-info">
              <div class="emp-name">{{ e.name }}</div>
              <div class="emp-sub">{{ e.position || e.department || e.email }}</div>
            </div>

            <div class="emp-status">
              <span v-if="e.already_marked" class="status-chip marked">
                <AppIcon name="check-circle" :size="12" />
                {{ e.already_status }} · {{ e.already_check_in }}
              </span>
              <span v-else-if="!e.has_location" class="status-chip no-signal">
                <AppIcon name="alert-triangle" :size="12" />
                No location
              </span>
              <span v-else-if="e.in_zone" class="status-chip in-zone-chip">
                <AppIcon name="location" :size="12" />
                {{ e.distance }}m · in zone
              </span>
              <span v-else class="status-chip out-zone">
                <AppIcon name="location" :size="12" />
                {{ e.distance }}m away
              </span>
            </div>
          </div>
        </div>

        <!-- Mark status + action -->
        <div class="mark-action-bar">
          <div class="mark-status-select">
            <label class="form-label">Mark as</label>
            <select v-model="markStatus" class="form-input form-select">
              <option value="present">Present</option>
              <option value="late">Late</option>
            </select>
          </div>
          <button class="btn btn-primary btn-mark" @click="markSelected" :disabled="marking || !selectedIds.size">
            <span v-if="marking" class="btn-spinner"></span>
            <AppIcon v-else name="check-circle" :size="16" />
            {{ marking ? 'Recording...' : `Record Attendance (${selectedIds.size})` }}
          </button>
        </div>
      </template>
    </div>

    <!-- How it works -->
    <div class="glass how-card">
      <div class="hiw-title"><AppIcon name="info" :size="14" />How Regular Attendance Works</div>
      <div class="hiw-steps">
        <div class="hiw-step"><span class="step-num">1</span>Pick the zone — your {{ vocab.orgNoun.toLowerCase() }}'s saved location, or your current position when out in the field.</div>
        <div class="hiw-step"><span class="step-num">2</span>Scan looks at each {{ vocab.personNoun.toLowerCase() }}'s last known device location and checks who falls inside the radius.</div>
        <div class="hiw-step"><span class="step-num">3</span>Select who to mark, then record — this creates their attendance for today, quietly, with no alert sent to them.</div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import EmptyState from '../ui/EmptyState.vue'
import { useToast } from '../../composables/useToast'
import { useIndustry } from '../../composables/useIndustry'
import { getAccurateLocation } from '../../composables/useAccurateLocation'
import api from '../../api'

const toast = useToast()
const { vocab } = useIndustry()

const API = import.meta.env.VITE_API_URL || 'https://esa-system.onrender.com/api'
const apiBase = API.replace('/api', '')
function resolveAvatar(url) {
  if (!url) return null
  if (url.startsWith('http') || url.startsWith('//')) return url
  return `${apiBase}${url}`
}

const zoneSource       = ref('company') // 'company' | 'current'
const companyCenter    = ref({ lat: null, lng: null })
const currentCenter    = ref({ lat: null, lng: null })
const currentGpsAccuracy = ref(null)
const detectingGPS     = ref(false)
const radius            = ref(200)
const scanning           = ref(false)
const scanned            = ref(false)
const marking             = ref(false)
const employees          = ref([])
const selectedIds        = ref(new Set())
const markStatus         = ref('present')

const center = computed(() => zoneSource.value === 'company' ? companyCenter.value : currentCenter.value)

const inZoneCount = computed(() => employees.value.filter(e => e.in_zone).length)

const allSelectableChecked = computed(() => {
  const selectable = employees.value.filter(e => e.in_zone && !e.already_marked)
  if (!selectable.length) return false
  return selectable.every(e => selectedIds.value.has(e.teacher_id))
})

function toggleSelect(id) {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedIds.value = s
}

function toggleSelectAll() {
  const selectable = employees.value.filter(e => e.in_zone && !e.already_marked)
  if (allSelectableChecked.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(selectable.map(e => e.teacher_id))
  }
}

async function loadCompanyLocation() {
  try {
    const r = await api.get('/settings')
    const d = (r && typeof r === 'object') ? r : {}
    if (d.school_lat && d.school_lng) {
      companyCenter.value = { lat: parseFloat(d.school_lat), lng: parseFloat(d.school_lng) }
      if (d.radius) radius.value = parseInt(d.radius) || radius.value
    }
  } catch {}
}

function selectCompanyZone() {
  zoneSource.value = 'company'
  scanned.value = false
}

function selectCurrentZone() {
  zoneSource.value = 'current'
  scanned.value = false
  if (currentCenter.value.lat == null) detectCurrentLocation()
}

async function detectCurrentLocation() {
  if (!navigator.geolocation) { toast.error('GPS not available in this browser'); return }
  detectingGPS.value = true
  try {
    const pos = await getAccurateLocation()
    currentCenter.value = { lat: pos.lat, lng: pos.lng }
    currentGpsAccuracy.value = pos.accuracy
    toast.success(`Location set (±${Math.round(pos.accuracy)}m)`)
  } catch (err) {
    toast.error(err?.message || 'Could not detect location — check browser permissions')
  } finally {
    detectingGPS.value = false
  }
}

async function scanZone() {
  if (center.value.lat == null || center.value.lng == null) {
    toast.error('Set a zone location first')
    return
  }
  scanning.value = true
  try {
    const r = await api.post('/school/regular-attendance/scan', {
      lat: center.value.lat, lng: center.value.lng, radius: radius.value,
    })
    employees.value = Array.isArray(r?.employees) ? r.employees : []
    scanned.value = true
    selectedIds.value = new Set()
  } catch (e) {
    toast.error(e.response?.data?.message || 'Scan failed')
  } finally {
    scanning.value = false
  }
}

async function markSelected() {
  if (!selectedIds.value.size) return
  marking.value = true
  try {
    const r = await api.post('/school/regular-attendance/mark', {
      teacher_ids: Array.from(selectedIds.value),
      lat: center.value.lat, lng: center.value.lng,
      status: markStatus.value,
    })
    toast.success(r?.marked?.length ? `${r.marked.length} employee(s) recorded` : 'No changes made')
    selectedIds.value = new Set()
    await scanZone()
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed to record attendance')
  } finally {
    marking.value = false
  }
}

onMounted(async () => {
  await loadCompanyLocation()
})
</script>

<style scoped>
.reg-att-page { display:flex; flex-direction:column; gap:16px; }
.reg-att-header { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px; }
.page-title { font-size:22px; font-weight:800; }
.page-desc  { font-size:13px; color:var(--text-muted); margin-top:4px; }

.privacy-note {
  display:flex; align-items:flex-start; gap:8px; padding:11px 14px;
  border-radius:var(--radius-sm); background:rgba(37,99,235,0.06);
  border:1px solid rgba(37,99,235,0.16); font-size:12.5px; color:var(--text-secondary); line-height:1.5;
}

.zone-card, .results-card, .how-card { border-radius:var(--radius-lg); overflow:hidden; }
.card-head { display:flex; align-items:center; gap:14px; padding:16px 18px; border-bottom:1px solid var(--surface-border); }
.card-icon-wrap { width:40px; height:40px; border-radius:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.card-head-text { flex:1; min-width:0; }
.card-title { font-size:15px; font-weight:700; }
.card-desc  { font-size:12px; color:var(--text-muted); margin-top:2px; }
.card-body  { padding:16px 18px; display:flex; flex-direction:column; gap:16px; }

/* Zone source */
.zone-source-toggle { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.zone-src-btn {
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px;
  padding:14px 10px; border-radius:var(--radius-sm); border:1.5px solid var(--surface-border);
  background:var(--surface); color:var(--text-secondary); font-size:12.5px; font-weight:700;
  cursor:pointer; transition:all 0.2s; font-family:var(--font); text-align:center;
}
.zone-src-btn:hover { border-color:var(--primary); color:var(--primary); }
.zone-src-btn.active {
  background:rgba(37,99,235,0.08); border-color:var(--primary); color:var(--primary);
  box-shadow:0 0 0 3px var(--primary-glow);
}

.current-loc-row { display:flex; flex-direction:column; gap:6px; }
.gps-accuracy-hint { font-size:11px; color:var(--text-muted); text-align:center; }

.zone-coords-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.zc-item { padding:10px 12px; border-radius:var(--radius-sm); background:var(--surface); border:1px solid var(--surface-border); }
.zc-label { display:block; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); margin-bottom:3px; }
.zc-val { font-size:13px; font-weight:700; }
.mono-font { font-family:var(--mono); }

.form-group  { display:flex; flex-direction:column; gap:6px; }
.form-label  { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-secondary); }
.form-input  { padding:10px 12px; background:var(--surface); border:1.5px solid var(--surface-border); border-radius:var(--radius-sm); color:var(--text); font-size:14px; font-family:var(--font); width:100%; box-sizing:border-box; }
.form-select { cursor:pointer; }
.radius-header { display:flex; align-items:center; justify-content:space-between; }
.radius-badge  { background:rgba(37,99,235,0.12); color:var(--primary); font-size:12px; font-weight:700; padding:2px 8px; border-radius:99px; font-family:var(--mono); }
.range-slider  { width:100%; accent-color:var(--primary); }
.range-marks   { display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:-6px; }
.full-w { width:100%; justify-content:center; }

/* Results */
.results-header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 18px; border-bottom:1px solid var(--surface-border); }
.results-header-text { min-width:0; }
.icon-btn { width:34px; height:34px; border-radius:var(--radius-sm); border:1px solid var(--surface-border); background:var(--surface); color:var(--text-secondary); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; flex-shrink:0; }
.icon-btn:hover { border-color:var(--primary); color:var(--primary); }
.icon-btn:disabled { opacity:0.5; cursor:not-allowed; }
.spinning { animation:spin 1s linear infinite; }
.empty-wrap { padding:20px; }

.select-all-row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 18px; border-bottom:1px solid var(--surface-border); flex-wrap:wrap; }
.check-row { display:flex; align-items:center; gap:8px; font-size:12.5px; font-weight:600; color:var(--text-secondary); cursor:pointer; }
.check-row input[type=checkbox] { width:17px; height:17px; accent-color:var(--primary); cursor:pointer; }
.selected-count { font-size:12px; font-weight:700; color:var(--primary); }

.employee-list { display:flex; flex-direction:column; }
.employee-row {
  display:flex; align-items:center; gap:12px; padding:12px 18px;
  border-bottom:1px solid var(--surface-border); transition:background 0.15s;
}
.employee-row:last-child { border-bottom:none; }
.employee-row.in-zone { background:rgba(16,185,129,0.03); }
.employee-row.already-marked { opacity:0.65; }
.emp-check { flex-shrink:0; }
.emp-avatar {
  width:38px; height:38px; border-radius:10px; flex-shrink:0;
  background:linear-gradient(135deg,var(--primary),var(--accent));
  display:flex; align-items:center; justify-content:center;
  color:#fff; font-size:14px; font-weight:800; overflow:hidden;
}
.emp-avatar-img { width:100%; height:100%; object-fit:cover; }
.emp-info { flex:1; min-width:0; }
.emp-name { font-size:13.5px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.emp-sub  { font-size:11.5px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.emp-status { flex-shrink:0; }
.status-chip { display:flex; align-items:center; gap:4px; padding:4px 9px; border-radius:99px; font-size:11px; font-weight:700; white-space:nowrap; }
.status-chip.marked      { background:rgba(16,185,129,0.12); color:var(--success); }
.status-chip.no-signal   { background:rgba(148,163,184,0.12); color:var(--text-muted); }
.status-chip.in-zone-chip{ background:rgba(37,99,235,0.12);  color:var(--primary); }
.status-chip.out-zone    { background:rgba(245,158,11,0.1);  color:var(--warning); }

.mark-action-bar { display:flex; align-items:flex-end; gap:10px; padding:16px 18px; border-top:1px solid var(--surface-border); background:rgba(37,99,235,0.02); flex-wrap:wrap; }
.mark-status-select { display:flex; flex-direction:column; gap:6px; min-width:140px; }
.btn-mark { flex:1; min-width:200px; justify-content:center; }

/* How it works */
.how-card { padding:16px 18px; }
.hiw-title { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; margin-bottom:10px; color:var(--primary); }
.hiw-steps { display:flex; flex-direction:column; gap:8px; }
.hiw-step  { display:flex; align-items:flex-start; gap:10px; font-size:12.5px; color:var(--text-secondary); line-height:1.5; }
.step-num  { width:20px; height:20px; border-radius:50%; background:rgba(37,99,235,0.12); color:var(--primary); font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

.btn-spinner    { width:14px; height:14px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.8s linear infinite; }
.btn-spinner-xs { width:12px; height:12px; border:2px solid var(--surface-border); border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

/* ── Mobile-first responsive tuning ── */
@media (max-width:768px) {
  .reg-att-page { gap:12px; }
  .page-title { font-size:19px; }
  .card-head { padding:14px 14px; gap:10px; }
  .card-body { padding:14px 14px; gap:14px; }
  .zone-source-toggle { gap:6px; }
  .zone-src-btn { padding:12px 6px; font-size:11.5px; }
  .zone-coords-row { grid-template-columns:1fr 1fr; gap:6px; }
  .zc-item { padding:8px 10px; }
  .zc-val { font-size:12px; }
  .results-header { padding:14px 14px; }
  .select-all-row { padding:10px 14px; }
  .employee-row { padding:10px 14px; gap:10px; }
  .emp-avatar { width:34px; height:34px; font-size:12px; }
  .emp-name { font-size:13px; }
  .status-chip { font-size:10px; padding:3px 7px; }
  .mark-action-bar { padding:14px; flex-direction:column; align-items:stretch; }
  .mark-status-select { min-width:0; width:100%; }
  .btn-mark { min-width:0; width:100%; }
  .how-card { padding:14px; }
}
@media (max-width:420px) {
  .emp-sub { display:none; }
  .status-chip span { display:none; }
}
</style>
