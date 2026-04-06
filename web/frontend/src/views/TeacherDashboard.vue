<template>
  <DashboardLayout :navSections="navSections" :pageTitle="currentPageTitle" pageSubtitle="Teacher Portal">
    <Transition name="page" mode="out-in">

      <!-- ══════════════════════════════════════════════
           DASHBOARD SECTION
      ══════════════════════════════════════════════ -->
      <div v-if="section === 'dashboard'" key="dash">

        <!-- ── MOBILE layout (≤768px): stacked simple cards ── -->
        <div class="mobile-layout">
          <CheckInCard :todayRecord="todayRecord" @refresh="fetchToday" />

          <!-- Live GPS Map — mobile only -->
          <div class="mobile-map-section">
            <div class="mobile-map-header">
              <div class="mmh-left">
                <div class="mmh-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <span class="mmh-title">Live Location</span>
              </div>
              <div class="mmh-badge" :class="schoolInfo?.lat ? 'mmh-ok' : 'mmh-warn'">
                <span class="mmh-dot"></span>
                {{ schoolInfo?.lat ? 'GPS Active' : 'Not Configured' }}
              </div>
            </div>
            <TeacherLiveMap
              :schoolLat="schoolInfo?.lat"
              :schoolLng="schoolInfo?.lng"
              :schoolName="schoolInfo?.name || schoolName"
              :schoolRadius="schoolInfo?.radius || schoolConfig.radius || 200"
              class="mobile-map-component"
            />
          </div>

          <!-- Quick stats row -->
          <div class="mobile-stats-row">
            <div class="mobile-stat glass" v-for="s in quickStats" :key="s.label">
              <div class="ms-val" :style="`color:${s.color}`">{{ s.val }}</div>
              <div class="ms-label">{{ s.label }}</div>
            </div>
          </div>

          <!-- Recent records (mobile only shows 3) -->
          <div class="glass mobile-recent">
            <div class="section-head-sm">
              <AppIcon name="attendance" :size="15" color="var(--primary)" />
              <span>Recent</span>
            </div>
            <div v-if="recentRecords.length" class="recent-list-sm">
              <div v-for="r in recentRecords" :key="r.id" class="recent-item-sm">
                <div class="ri-date">
                  <div class="ri-day">{{ dayNum(r.date) }}</div>
                  <div class="ri-mon">{{ monthShort(r.date) }}</div>
                </div>
                <div class="ri-times">
                  <span class="ri-in">{{ r.check_in || '—' }}</span>
                  <span class="ri-sep">→</span>
                  <span class="ri-out">{{ r.check_out || '—' }}</span>
                </div>
                <AppBadge :variant="r.status" :label="r.status" dot />
              </div>
            </div>
            <EmptyState v-else icon="attendance" title="No records yet" message="" />
          </div>
        </div>

        <!-- ── DESKTOP layout (>768px): two-column ── -->
        <div class="desktop-layout">

          <!-- LEFT: main column -->
          <div class="desk-main">
            <CheckInCard :todayRecord="todayRecord" @refresh="fetchToday" />

            <!-- Week summary chart bar -->
            <div class="glass desk-card">
              <div class="card-title-row">
                <AppIcon name="bar-chart" :size="17" color="var(--primary)" />
                <span class="card-title-text">This Month At a Glance</span>
                <span class="month-tag">{{ currentMonthLabel }}</span>
              </div>
              <div class="month-big-stats">
                <div class="mbs-item" v-for="s in monthStats" :key="s.label">
                  <div class="mbs-val" :style="`color:${s.color}`">{{ s.val }}</div>
                  <div class="mbs-bar">
                    <div class="mbs-fill" :style="`width:${s.pct}%;background:${s.color}`"></div>
                  </div>
                  <div class="mbs-label">{{ s.label }}</div>
                </div>
              </div>

              <!-- Attendance rate ring -->
              <div class="rate-display">
                <div class="rate-ring-wrap">
                  <svg viewBox="0 0 80 80" class="rate-svg">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="var(--surface-border)" stroke-width="8"/>
                    <circle cx="40" cy="40" r="32" fill="none" stroke="var(--success)" stroke-width="8"
                      stroke-linecap="round" transform="rotate(-90 40 40)"
                      :stroke-dasharray="`${201 * monthAttendanceRate / 100} 201`"
                      style="transition:stroke-dasharray 1s ease"
                    />
                  </svg>
                  <div class="rate-label-inner">
                    <div class="rate-pct">{{ monthAttendanceRate }}%</div>
                    <div class="rate-text">Rate</div>
                  </div>
                </div>
                <div class="rate-info">
                  <div class="rate-title">Monthly Attendance Rate</div>
                  <div class="rate-sub">{{ monthStats.find(s=>s.label==='Present')?.val || 0 }} present out of {{ monthRecordsAll.length }} school days this month</div>
                  <div class="rate-trend" :class="monthAttendanceRate >= 80 ? 'good' : monthAttendanceRate >= 60 ? 'ok' : 'bad'">
                    {{ monthAttendanceRate >= 80 ? 'Excellent' : monthAttendanceRate >= 60 ? 'Needs improvement' : 'Low attendance' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Full attendance history -->
            <AttendanceHistory :records="records" />
          </div>

          <!-- RIGHT: sidebar column -->
          <div class="desk-sidebar">

            <!-- School info card -->
            <div class="glass desk-card">
              <div class="card-title-row">
                <AppIcon name="school" :size="17" color="var(--accent)" />
                <span class="card-title-text">My School</span>
              </div>
              <div class="school-info-card">
                <div class="school-avatar-lg">{{ schoolName?.charAt(0) || 'S' }}</div>
                <div class="school-name-lg">{{ schoolName || '—' }}</div>
                <div class="school-detail-row" v-for="d in schoolDetails" :key="d.label">
                  <AppIcon :name="d.icon" :size="13" color="var(--text-muted)" />
                  <span class="sd-label">{{ d.label }}</span>
                  <span class="sd-val" :style="d.color ? `color:${d.color}` : ''">{{ d.val }}</span>
                </div>
              </div>
            </div>

            <!-- Weekly pattern -->
            <div class="glass desk-card">
              <div class="card-title-row">
                <AppIcon name="analytics" :size="17" color="var(--info)" />
                <span class="card-title-text">This Week</span>
              </div>
              <div class="week-days">
                <div
                  v-for="d in weekDays"
                  :key="d.day"
                  class="week-day-cell"
                  :class="d.status"
                  :title="`${d.dayFull}: ${d.status}`"
                >
                  <div class="wdc-day">{{ d.day }}</div>
                  <div class="wdc-dot"></div>
                  <div class="wdc-status">{{ d.statusShort }}</div>
                </div>
              </div>
              <div class="week-legend">
                <span class="wl-item present"><span class="wl-dot"></span>Present</span>
                <span class="wl-item late"><span class="wl-dot"></span>Late</span>
                <span class="wl-item absent"><span class="wl-dot"></span>Absent</span>
                <span class="wl-item future"><span class="wl-dot"></span>Upcoming</span>
              </div>
            </div>

            <!-- Profile mini card -->
            <div class="glass desk-card">
              <div class="card-title-row">
                <AppIcon name="user" :size="17" color="var(--primary)" />
                <span class="card-title-text">My Profile</span>
                <button class="link-btn" @click="goSection('profile')">View →</button>
              </div>
              <div class="profile-mini">
                <div class="pm-avatar">{{ initials }}</div>
                <div>
                  <div class="pm-name">{{ user?.name }}</div>
                  <div class="pm-email">{{ user?.email }}</div>
                  <AppBadge variant="primary" label="Teacher" style="margin-top:6px" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════
           LIVE GPS MAP SECTION — web only, desktop redirects away
      ══════════════════════════════════════════════ -->
      <div v-else-if="section === 'map'" key="map" class="map-section">
        <!-- Section header -->
        <div class="map-sec-header">
          <div class="map-sec-left">
            <div class="map-sec-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a9eff" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div>
              <h2 class="map-sec-title">Live Location Tracking</h2>
              <p class="map-sec-sub">Real-time GPS · Route to school · Distance estimate</p>
            </div>
          </div>
          <div class="map-sec-badge" :class="schoolInfo?.lat ? 'badge-ok' : 'badge-warn'">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="schoolInfo?.lat ? '#10b981' : '#f59e0b'" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            {{ schoolInfo?.name || 'School not configured' }}
          </div>
        </div>

        <!-- Warning if no school GPS -->
        <div v-if="!schoolInfo?.lat" class="no-gps-warn glass">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <div class="warn-title">School GPS not configured</div>
            <div class="warn-sub">Ask your school admin to set the school location in Settings. The map will still show your position.</div>
          </div>
        </div>

        <!-- Map component -->
        <TeacherLiveMap
          :schoolLat="schoolInfo?.lat"
          :schoolLng="schoolInfo?.lng"
          :schoolName="schoolInfo?.name || schoolName"
          :schoolRadius="schoolInfo?.radius || schoolConfig.radius || 200"
        />

        <!-- Info cards below map -->
        <div class="map-info-cards">
          <div class="glass mic">
            <div class="mic-icon" style="background:rgba(74,158,255,0.1);color:#4a9eff">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div>
              <div class="mic-label">GPS Status</div>
              <div class="mic-val" style="color:#10b981">Live Tracking Active</div>
            </div>
          </div>
          <div class="glass mic">
            <div class="mic-icon" style="background:rgba(255,120,30,0.1);color:#ff8c40">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div>
              <div class="mic-label">School</div>
              <div class="mic-val">{{ schoolInfo?.name || schoolName || '—' }}</div>
            </div>
          </div>
          <div class="glass mic">
            <div class="mic-icon" :style="`background:${statusIconBg};color:${statusColor}`">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div>
              <div class="mic-label">Today's Status</div>
              <div class="mic-val" :style="`color:${statusColor}`">
                {{ todayRecord?.status ? todayRecord.status.charAt(0).toUpperCase() + todayRecord.status.slice(1) : 'Not checked in' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════
           HISTORY SECTION
      ══════════════════════════════════════════════ -->
      <div v-else-if="section === 'history'" key="history">
        <!-- Desktop: stats + history side by side -->
        <div class="history-layout">
          <div class="history-main">
            <AttendanceHistory :records="records" />
          </div>
          <div class="history-sidebar desktop-only">
            <div class="glass desk-card">
              <div class="card-title-row">
                <AppIcon name="analytics" :size="17" color="var(--primary)" />
                <span class="card-title-text">All-Time Stats</span>
              </div>
              <div class="alltime-stats">
                <div class="at-stat" v-for="s in allTimeStats" :key="s.label">
                  <div class="at-val" :style="`color:${s.color}`">{{ s.val }}</div>
                  <div class="at-label">{{ s.label }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════
           PROFILE SECTION
      ══════════════════════════════════════════════ -->
      <div v-else-if="section === 'profile'" key="profile">
        <div class="profile-layout">
          <!-- Profile card -->
          <div class="glass profile-card">
            <div class="profile-hero">
              <div class="profile-avatar-xl">{{ initials }}</div>
              <div class="profile-hero-info">
                <h2>{{ user?.name }}</h2>
                <p>{{ user?.email }}</p>
                <div class="profile-badges">
                  <AppBadge variant="primary" label="Teacher" />
                  <AppBadge :variant="todayRecord?.status || 'absent'" :label="todayRecord?.status || 'Not checked in today'" dot />
                </div>
              </div>
            </div>
            <div class="profile-fields">
              <div class="pf-row" v-for="f in profileFields" :key="f.label">
                <div class="pf-icon-wrap"><AppIcon :name="f.icon" :size="15" color="var(--text-muted)" /></div>
                <div class="pf-content">
                  <div class="pf-label">{{ f.label }}</div>
                  <div class="pf-val">{{ f.val }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Lifetime stats (desktop only shows alongside) -->
          <div class="profile-stats-col desktop-only">
            <div class="glass desk-card">
              <div class="card-title-row">
                <AppIcon name="analytics" :size="17" color="var(--info)" />
                <span class="card-title-text">Career Stats</span>
              </div>
              <div class="career-stats">
                <div class="cs-stat" v-for="s in allTimeStats" :key="s.label">
                  <div class="cs-val" :style="`color:${s.color}`">{{ s.val }}</div>
                  <div class="cs-label">{{ s.label }}</div>
                  <div class="cs-bar"><div class="cs-fill" :style="`width:${s.pct||0}%;background:${s.color}`"></div></div>
                </div>
              </div>
            </div>
            <div class="glass desk-card">
              <div class="card-title-row">
                <AppIcon name="school" :size="17" color="var(--accent)" />
                <span class="card-title-text">School Details</span>
              </div>
              <div class="school-detail-row" v-for="d in schoolDetails" :key="d.label">
                <AppIcon :name="d.icon" :size="13" color="var(--text-muted)" />
                <span class="sd-label">{{ d.label }}</span>
                <span class="sd-val">{{ d.val }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </Transition>
  </DashboardLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashboardLayout    from '../components/layout/DashboardLayout.vue'
import CheckInCard        from '../components/teacher/CheckInCard.vue'
import AttendanceHistory  from '../components/teacher/AttendanceHistory.vue'
import TeacherLiveMap     from '../components/teacher/TeacherLiveMap.vue'
import AppBadge           from '../components/ui/AppBadge.vue'
import AppIcon            from '../components/ui/AppIcon.vue'
import EmptyState         from '../components/ui/EmptyState.vue'
import { useAuthStore }   from '../stores/auth'
import { getSocket }      from '../socket'
import api from '../api'

const auth   = useAuthStore()
const route  = useRoute()
const router = useRouter()

// ── Desktop detection ────────────────────────────────────────────────────────
const isDesktop = ref(typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron'))

const user     = computed(() => auth.user)
const initials = computed(() => user.value?.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'T')

/* ── Section ── */
const routeMap = { '/teacher/dashboard': 'dashboard', '/teacher/map': 'map', '/teacher/history': 'history', '/teacher/profile': 'profile' }
const section  = ref(routeMap[route.path] || 'dashboard')

// On desktop, the Live GPS Map page does not exist — redirect to dashboard
function guardMapRoute(path) {
  const s = routeMap[path] || 'dashboard'
  if (isDesktop.value && s === 'map') {
    router.replace('/teacher/dashboard')
    return 'dashboard'
  }
  return s
}

watch(() => route.path, p => { section.value = guardMapRoute(p) })

function goSection(s) {
  const pathMap = { dashboard:'/teacher/dashboard', history:'/teacher/history', profile:'/teacher/profile' }
  router.push(pathMap[s] || '/teacher/dashboard')
}

/* ── State ── */
const todayRecord  = ref(null)
const records      = ref([])
const schoolName   = ref('')
const schoolConfig = ref({})
const schoolInfo   = ref(null)  // { id, name, lat, lng }

/* ── Nav ── */
const _allNavItems = [
  { to: '/teacher/dashboard', label: 'Dashboard',    icon: 'dashboard'  },
  { to: '/teacher/map',       label: 'Live GPS Map', icon: 'location',  desktopHide: true },
  { to: '/teacher/history',   label: 'Attendance',   icon: 'attendance' },
  { to: '/teacher/profile',   label: 'My Profile',   icon: 'profile'    },
]
const navSections = computed(() => [{
  group: 'My Portal',
  items: _allNavItems.filter(i => !(isDesktop.value && i.desktopHide)),
}])
const pageTitles       = { dashboard: 'My Dashboard', map: 'Live GPS Map', history: 'My Attendance', profile: 'My Profile' }
const currentPageTitle = computed(() => pageTitles[section.value] || 'Dashboard')

/* ── Quick stats (mobile) ── */
const quickStats = computed(() => {
  const now  = new Date()
  const sow  = new Date(now); sow.setDate(now.getDate() - now.getDay()); sow.setHours(0,0,0,0)
  const week = records.value.filter(r => new Date(r.date) >= sow)
  return [
    { val: week.filter(r => r.status === 'present').length, label: 'Present', color: 'var(--success)' },
    { val: week.filter(r => r.status === 'late').length,    label: 'Late',    color: 'var(--warning)' },
    { val: week.filter(r => r.status === 'absent').length,  label: 'Absent',  color: 'var(--danger)'  },
  ]
})

/* ── Recent records (mobile shows 3) ── */
const recentRecords = computed(() => records.value.slice(0, 3))

/* ── Current month records ── */
const currentMonthLabel = computed(() => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))
const monthRecordsAll = computed(() => {
  const now = new Date()
  return records.value.filter(r => {
    const d = new Date(r.date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
})

const monthStats = computed(() => {
  const r       = monthRecordsAll.value
  const total   = r.length || 1
  const present = r.filter(x => x.status === 'present').length
  const late    = r.filter(x => x.status === 'late').length
  const absent  = r.filter(x => x.status === 'absent').length
  return [
    { label: 'Present', val: present, color: 'var(--success)', pct: Math.round(present/total*100) },
    { label: 'Late',    val: late,    color: 'var(--warning)', pct: Math.round(late/total*100)    },
    { label: 'Absent',  val: absent,  color: 'var(--danger)',  pct: Math.round(absent/total*100)  },
  ]
})

const monthAttendanceRate = computed(() => {
  const r = monthRecordsAll.value
  if (!r.length) return 0
  return Math.round(r.filter(x => x.status === 'present' || x.status === 'late').length / r.length * 100)
})

/* ── All-time stats ── */
const allTimeStats = computed(() => {
  const r       = records.value
  const total   = r.length || 1
  const present = r.filter(x => x.status === 'present').length
  const late    = r.filter(x => x.status === 'late').length
  const absent  = r.filter(x => x.status === 'absent').length
  return [
    { label: 'Total Days',     val: r.length, color: 'var(--primary)', pct: 100 },
    { label: 'Present',        val: present,  color: 'var(--success)', pct: Math.round(present/total*100) },
    { label: 'Late',           val: late,     color: 'var(--warning)', pct: Math.round(late/total*100) },
    { label: 'Absent',         val: absent,   color: 'var(--danger)',  pct: Math.round(absent/total*100) },
    { label: 'Attendance Rate',val: `${Math.round((present+late)/total*100)}%`, color: 'var(--accent)', pct: Math.round((present+late)/total*100) },
  ]
})

/* ── Week days display ── */
const weekDays = computed(() => {
  const days  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const full  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const now   = new Date()
  const start = new Date(now); start.setDate(now.getDate() - now.getDay())
  const short = { present:'✓', late:'L', absent:'✗', future:'·' }
  return days.map((d, i) => {
    const date = new Date(start); date.setDate(start.getDate() + i)
    const iso  = date.toISOString().split('T')[0]
    const rec  = records.value.find(r => r.date === iso)
    const isWeekend = i === 0 || i === 6
    const isFuture  = date > now && date.toDateString() !== now.toDateString()
    const status = isWeekend ? 'weekend' : isFuture ? 'future' : rec?.status || 'absent'
    return { day: d, dayFull: full[i], status, statusShort: isWeekend ? '—' : isFuture ? '·' : short[rec?.status] || '✗' }
  })
})

/* ── School details ── */
const schoolDetails = computed(() => [
  { icon: 'school',  label: 'School Name', val: schoolName.value  || '—' },
  { icon: 'shield',  label: 'Role',        val: 'Teacher'               },
  { icon: 'clock',   label: 'Check-in by', val: fmtTime(schoolConfig.value?.late_threshold)   || '—' },
  { icon: 'location',label: 'GPS Check',   val: schoolConfig.value?.gps_enabled ? 'Required' : 'Optional', color: schoolConfig.value?.gps_enabled ? 'var(--warning)' : 'var(--text-muted)' },
])

/* ── Profile fields ── */
const profileFields = computed(() => [
  { icon: 'user',       label: 'Full Name',    val: user.value?.name  || '—' },
  { icon: 'user',       label: 'Email Address', val: user.value?.email || '—' },
  { icon: 'school',     label: 'School',       val: schoolName.value  || '—' },
  { icon: 'shield',     label: 'Role',         val: 'Teacher'               },
  { icon: 'attendance', label: 'Total Records', val: `${records.value.length} days` },
])

/* ── Status color ── */
const statusColor = computed(() => {
  const s = todayRecord.value?.status
  if (s === 'present') return 'var(--success)'
  if (s === 'late')    return 'var(--warning)'
  if (s === 'absent')  return 'var(--danger)'
  return 'var(--text-muted)'
})

const statusIconBg = computed(() => {
  const s = todayRecord.value?.status
  if (s === 'present') return 'rgba(16,185,129,0.1)'
  if (s === 'late')    return 'rgba(245,158,11,0.1)'
  if (s === 'absent')  return 'rgba(239,68,68,0.1)'
  return 'rgba(148,163,184,0.1)'
})

/* ── Helpers ── */
function dayNum(d)    { return new Date(d).getDate() }
function monthShort(d){ return new Date(d).toLocaleDateString('en-US', { month: 'short' }) }
function fmtTime(t)   { if (!t) return ''; const [h,m]=t.split(':'); const ampm=h>=12?'PM':'AM'; return `${h%12||12}:${m} ${ampm}` }

/* ── Fetchers ── */
// NOTE: api.js interceptor unwraps the { success, data, message } envelope,
// so the resolved value IS the inner data directly — no .data property needed.
async function fetchToday() {
  try { const r = await api.get('/attendance/today'); todayRecord.value = r ?? null }
  catch { todayRecord.value = null }
}
async function fetchHistory() {
  try { const r = await api.get('/attendance/my'); records.value = Array.isArray(r) ? r : [] }
  catch { records.value = [] }
}
async function fetchSchool() {
  try {
    const r = await api.get('/school/info'); schoolName.value = r?.name || ''
    const s = await api.get('/teacher/settings'); Object.assign(schoolConfig.value, (s && typeof s === 'object') ? s : {})
    // Fetch school GPS location for the map
    try {
      const loc = await api.get('/teacher/school-location')
      schoolInfo.value = loc ?? null
    } catch {}
  } catch {}
}

onMounted(async () => {
  section.value = guardMapRoute(route.path)
  await Promise.all([fetchToday(), fetchHistory(), fetchSchool()])
  const socket = getSocket()
  if (socket) {
    socket.on('attendance_marked', fetchToday)
    socket.on('settings_updated', fetchSchool)
    socket.on('auto_checkout_complete', fetchToday)
  }
})
onUnmounted(() => {
  const socket = getSocket()
  if (socket) {
    socket.off('attendance_marked', fetchToday)
    socket.off('settings_updated', fetchSchool)
    socket.off('auto_checkout_complete', fetchToday)
  }
})
</script>

<style scoped>
/* ══ Mobile layout (shown only on mobile) ══ */
.mobile-layout  { display:flex; flex-direction:column; gap:16px; }
.desktop-layout { display:none; }

/* Mobile map section */
.mobile-map-section { border-radius:var(--radius-lg); overflow:hidden; border:1px solid rgba(74,158,255,0.2); }
.mobile-map-header  { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:rgba(6,13,31,0.9); border-bottom:1px solid rgba(74,158,255,0.15); }
.mmh-left   { display:flex; align-items:center; gap:8px; }
.mmh-icon   { width:28px; height:28px; border-radius:8px; background:rgba(74,158,255,0.1); display:flex; align-items:center; justify-content:center; }
.mmh-title  { font-size:13px; font-weight:700; color:#c8deff; }
.mmh-badge  { display:flex; align-items:center; gap:5px; font-size:11px; font-weight:600; padding:3px 8px; border-radius:99px; }
.mmh-ok     { background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2); color:#10b981; }
.mmh-warn   { background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.2); color:#f59e0b; }
.mmh-dot    { width:6px; height:6px; border-radius:50%; background:currentColor; animation:dotPulse 1.5s ease-in-out infinite; }
.mobile-map-component { height:280px !important; border-radius:0 !important; border:none !important; }

/* ══ Desktop layout (shown only on desktop) ══ */
@media (min-width: 769px) {
  .mobile-layout  { display:none; }
  .desktop-layout { display:grid; grid-template-columns:1fr 340px; gap:20px; align-items:start; }
}
@media (min-width:1200px) { .desktop-layout { grid-template-columns:1fr 380px; } }

/* ── Mobile stats row ── */
.mobile-stats-row { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
.mobile-stat { padding:14px 10px; border-radius:var(--radius); text-align:center; }
.ms-val  { font-size:28px; font-weight:800; line-height:1; }
.ms-label{ font-size:11px; color:var(--text-muted); margin-top:4px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; }

/* ── Mobile recent ── */
.mobile-recent { padding:16px; border-radius:var(--radius); }
.section-head-sm { display:flex; align-items:center; gap:7px; font-size:14px; font-weight:700; margin-bottom:12px; }
.recent-list-sm  { display:flex; flex-direction:column; gap:8px; }
.recent-item-sm  { display:flex; align-items:center; gap:12px; padding:10px 12px; background:var(--surface); border:1px solid var(--surface-border); border-radius:var(--radius-sm); }
.ri-date  { text-align:center; min-width:32px; }
.ri-day   { font-size:18px; font-weight:800; line-height:1; }
.ri-mon   { font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:600; }
.ri-times { flex:1; display:flex; align-items:center; gap:6px; font-size:12px; font-weight:600; font-family:var(--mono); color:var(--text-secondary); }
.ri-sep   { color:var(--text-muted); }

/* ── Shared card ── */
.desk-card { padding:18px 20px; border-radius:var(--radius-lg); margin-bottom:24px; margin-top:24px; }
.desk-main    { display:flex; flex-direction:column; gap:0; }
.desk-sidebar { display:flex; flex-direction:column; gap:0; }
.card-title-row { display:flex; align-items:center; gap:8px; margin-bottom:16px; }
.card-title-text{ font-size:15px; font-weight:700; flex:1; }
.month-tag { font-size:11px; color:var(--text-muted); background:var(--surface); padding:2px 8px; border-radius:99px; border:1px solid var(--surface-border); }
.link-btn  { background:none; border:none; color:var(--primary); font-size:12px; font-weight:600; cursor:pointer; font-family:var(--font); }

/* ── Month big stats ── */
.month-big-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px; }
.mbs-item { text-align:center; }
.mbs-val  { font-size:32px; font-weight:800; line-height:1; }
.mbs-bar  { height:4px; background:var(--surface-border); border-radius:99px; overflow:hidden; margin:6px 0 4px; }
.mbs-fill { height:100%; border-radius:99px; transition:width 1s ease; }
.mbs-label{ font-size:11px; color:var(--text-muted); font-weight:600; }

/* Rate display */
.rate-display { display:flex; align-items:center; gap:16px; padding:16px; background:rgba(37,99,235,0.04); border:1px solid var(--surface-border); border-radius:var(--radius); }
.rate-ring-wrap { position:relative; width:72px; height:72px; flex-shrink:0; }
.rate-svg { width:100%; height:100%; }
.rate-label-inner { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
.rate-pct  { font-size:16px; font-weight:800; }
.rate-text { font-size:9px; color:var(--text-muted); font-weight:600; text-transform:uppercase; }
.rate-title{ font-size:14px; font-weight:700; }
.rate-sub  { font-size:12px; color:var(--text-muted); margin-top:3px; line-height:1.4; }
.rate-trend{ font-size:12px; font-weight:700; margin-top:6px; padding:3px 9px; border-radius:99px; display:inline-block; }
.rate-trend.good{ background:rgba(16,185,129,0.12); color:var(--success); }
.rate-trend.ok  { background:rgba(245,158,11,0.12);  color:var(--warning); }
.rate-trend.bad { background:rgba(239,68,68,0.12);   color:var(--danger);  }

/* ── School info card ── */
.school-info-card { display:flex; flex-direction:column; align-items:center; gap:4px; }
.school-avatar-lg { width:56px; height:56px; border-radius:14px; background:linear-gradient(135deg,var(--accent),var(--accent-dark)); display:flex; align-items:center; justify-content:center; color:#fff; font-size:22px; font-weight:800; margin-bottom:6px; }
.school-name-lg { font-size:15px; font-weight:700; text-align:center; margin-bottom:10px; }
.school-detail-row { display:flex; align-items:center; gap:8px; width:100%; padding:8px 10px; border-radius:var(--radius-sm); background:var(--surface); border:1px solid var(--surface-border); margin-bottom:6px; font-size:12px; }
.sd-label { color:var(--text-muted); flex:1; font-weight:500; }
.sd-val   { font-weight:700; text-align:right; }

/* ── Week days ── */
.week-days { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; margin-bottom:10px; }
.week-day-cell { display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 4px; border-radius:var(--radius-sm); border:1.5px solid var(--surface-border); background:var(--surface); }
.week-day-cell.present { border-color:rgba(16,185,129,0.4); background:rgba(16,185,129,0.07); }
.week-day-cell.late    { border-color:rgba(245,158,11,0.4);  background:rgba(245,158,11,0.07); }
.week-day-cell.absent  { border-color:rgba(239,68,68,0.4);   background:rgba(239,68,68,0.06);  }
.week-day-cell.future  { opacity:0.4; }
.week-day-cell.weekend { opacity:0.3; }
.wdc-day    { font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase; }
.wdc-dot    { width:7px; height:7px; border-radius:50%; background:var(--surface-border); }
.week-day-cell.present .wdc-dot { background:var(--success); box-shadow:0 0 6px rgba(16,185,129,0.4); }
.week-day-cell.late    .wdc-dot { background:var(--warning); box-shadow:0 0 6px rgba(245,158,11,0.4); }
.week-day-cell.absent  .wdc-dot { background:var(--danger);  }
.wdc-status { font-size:10px; font-weight:700; color:var(--text-muted); }
.week-day-cell.present .wdc-status { color:var(--success); }
.week-day-cell.late    .wdc-status { color:var(--warning); }
.week-day-cell.absent  .wdc-status { color:var(--danger);  }
.week-legend { display:flex; gap:10px; flex-wrap:wrap; }
.wl-item { display:flex; align-items:center; gap:4px; font-size:11px; color:var(--text-muted); }
.wl-dot  { width:7px; height:7px; border-radius:50%; }
.wl-item.present .wl-dot { background:var(--success); }
.wl-item.late    .wl-dot { background:var(--warning); }
.wl-item.absent  .wl-dot { background:var(--danger);  }
.wl-item.future  .wl-dot { background:var(--surface-border); }

/* ── Profile mini ── */
.profile-mini { display:flex; align-items:center; gap:14px; }
.pm-avatar { width:46px; height:46px; border-radius:12px; background:linear-gradient(135deg,var(--primary),var(--accent)); display:flex; align-items:center; justify-content:center; color:#fff; font-size:17px; font-weight:800; flex-shrink:0; }
.pm-name  { font-size:14px; font-weight:700; }
.pm-email { font-size:12px; color:var(--text-muted); margin-top:1px; }

/* ── History layout ── */
.history-layout { display:flex; flex-direction:column; gap:20px; }
.history-sidebar { min-width:300px; }
.desktop-only   { display:none; }
@media (min-width:900px) {
  .history-layout  { flex-direction:row; align-items:start; }
  .history-main    { flex:1; }
  .history-sidebar { display:block; }
  .desktop-only    { display:block; }
}

/* ── All time stats ── */
.alltime-stats { display:flex; flex-direction:column; gap:10px; }
.at-stat { display:flex; align-items:center; gap:10px; }
.at-val  { font-size:20px; font-weight:800; min-width:36px; text-align:right; }
.at-label{ font-size:12px; color:var(--text-muted); flex:1; font-weight:500; }

/* ── Profile layout ── */
.profile-layout { display:flex; flex-direction:column; gap:20px; }
.profile-stats-col { display:flex; flex-direction:column; gap:0; }
@media (min-width:900px) {
  .profile-layout    { flex-direction:row; align-items:start; }
  .profile-card      { flex:1; }
  .profile-stats-col { display:flex; min-width:300px; }
}
.profile-card   { padding:24px; border-radius:var(--radius-xl); }
.profile-hero   { display:flex; align-items:center; gap:18px; margin-bottom:24px; padding-bottom:20px; border-bottom:1px solid var(--surface-border); flex-wrap:wrap; }
.profile-avatar-xl { width:72px; height:72px; border-radius:18px; background:linear-gradient(135deg,var(--primary),var(--accent)); display:flex; align-items:center; justify-content:center; color:#fff; font-size:26px; font-weight:800; flex-shrink:0; }
.profile-hero-info h2{ font-size:20px; font-weight:700; margin-bottom:3px; }
.profile-hero-info p { font-size:13px; color:var(--text-muted); margin-bottom:8px; }
.profile-badges { display:flex; gap:8px; flex-wrap:wrap; }
.profile-fields { display:flex; flex-direction:column; gap:8px; }
.pf-row { display:flex; align-items:center; gap:12px; padding:12px 14px; background:var(--surface); border:1px solid var(--surface-border); border-radius:var(--radius-sm); }
.pf-icon-wrap { width:32px; height:32px; border-radius:8px; background:rgba(37,99,235,0.08); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.pf-label { font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.05em; }
.pf-val   { font-size:14px; font-weight:600; margin-top:2px; }

/* Career stats */
.career-stats { display:flex; flex-direction:column; gap:12px; }
.cs-stat { }
.cs-val   { font-size:22px; font-weight:800; }
.cs-label { font-size:12px; color:var(--text-muted); font-weight:500; }
.cs-bar   { height:4px; background:var(--surface-border); border-radius:99px; overflow:hidden; margin-top:4px; }
.cs-fill  { height:100%; border-radius:99px; transition:width 1s ease; }

/* ══ Map Section ══ */
.map-section       { display:flex; flex-direction:column; gap:16px; }
.map-sec-header    { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
.map-sec-left      { display:flex; align-items:center; gap:14px; }
.map-sec-icon      { width:44px; height:44px; border-radius:12px; background:rgba(74,158,255,0.1); border:1px solid rgba(74,158,255,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.map-sec-title     { font-size:20px; font-weight:800; }
.map-sec-sub       { font-size:13px; color:var(--text-muted); margin-top:2px; }
.map-sec-badge     { display:flex; align-items:center; gap:6px; padding:5px 12px; border-radius:99px; font-size:12px; font-weight:600; }
.badge-ok   { background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2); color:#10b981; }
.badge-warn { background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.2); color:#f59e0b; }
.no-gps-warn { display:flex; align-items:flex-start; gap:14px; padding:14px 18px; border-radius:var(--radius-sm); border-left:3px solid var(--warning); }
.warn-title { font-size:14px; font-weight:700; }
.warn-sub   { font-size:13px; color:var(--text-muted); margin-top:3px; }
.map-info-cards { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.mic { display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:var(--radius); }
.mic-icon  { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.mic-label { font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.05em; }
.mic-val   { font-size:13px; font-weight:700; margin-top:3px; }
@media (max-width:640px) { .map-info-cards { grid-template-columns:1fr; } }


/* ══ Map Section ══ */
.map-section       { display:flex; flex-direction:column; gap:16px; }
.map-sec-header    { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
.map-sec-left      { display:flex; align-items:center; gap:14px; }
.map-sec-icon      { width:44px; height:44px; border-radius:12px; background:rgba(74,158,255,0.1); border:1px solid rgba(74,158,255,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.map-sec-title     { font-size:20px; font-weight:800; }
.map-sec-sub       { font-size:13px; color:var(--text-muted); margin-top:2px; }
.map-sec-badge     { display:flex; align-items:center; gap:6px; padding:5px 12px; border-radius:99px; font-size:12px; font-weight:600; }
.badge-ok   { background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2); color:#10b981; }
.badge-warn { background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.2); color:#f59e0b; }
.no-gps-warn { display:flex; align-items:flex-start; gap:14px; padding:14px 18px; border-radius:var(--radius-sm); border-left:3px solid var(--warning); }
.warn-title { font-size:14px; font-weight:700; }
.warn-sub   { font-size:13px; color:var(--text-muted); margin-top:3px; }
.map-info-cards { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.mic { display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:var(--radius); }
.mic-icon  { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.mic-label { font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.05em; }
.mic-val   { font-size:13px; font-weight:700; margin-top:3px; }
@media (max-width:640px) { .map-info-cards { grid-template-columns:1fr; } }

</style>