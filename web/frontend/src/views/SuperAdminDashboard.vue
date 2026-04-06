<template>
  <DashboardLayout
    :navSections="navSections"
    :pageTitle="currentPageTitle"
    pageSubtitle="Super Admin Control Panel"
  >
    <Transition name="page" mode="out-in">
      <SuperOverview
        v-if="section === 'dashboard'"
        key="overview"
        :stats="stats"
        :schools="schools"
        :activity="activity"
        @go-schools="goSection('schools')"
        @go-logs="goSection('logs')"
      />
      <SchoolsManager
        v-else-if="section === 'schools'"
        key="schools"
        :schools="schools"
        :loading="loadingSchools"
        @refresh="fetchSchools"
      />
      <SystemLogs
        v-else-if="section === 'logs'"
        key="logs"
        :logs="logs"
        :loading="loadingLogs"
        @refresh="fetchLogs"
      />
      <SuperSettings v-else-if="section === 'settings'" key="settings" />
      <ContactRequests v-else-if="section === 'contact-requests'" key="contact-requests" />
      <TrustedSchoolsBadges v-else-if="section === 'trusted-schools'" key="trusted-schools" />
    </Transition>
  </DashboardLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashboardLayout from '../components/layout/DashboardLayout.vue'
import SuperOverview   from '../components/super/SuperOverview.vue'
import SchoolsManager  from '../components/super/SchoolsManager.vue'
import SystemLogs      from '../components/super/SystemLogs.vue'
import SuperSettings   from '../components/super/SuperSettings.vue'
import ContactRequests from '../components/super/ContactRequests.vue'
import TrustedSchoolsBadges from '../components/super/TrustedSchoolsBadges.vue'
import api from '../api'
import { getSocket } from '../socket'

const route  = useRoute()
const router = useRouter()

/* ── Section detection from route ─────────────────────────────────────── */
const routeMap = {
  '/super/dashboard':         'dashboard',
  '/super/schools':           'schools',
  '/super/logs':              'logs',
  '/super/settings':          'settings',
  '/super/contact-requests':  'contact-requests',
  '/super/trusted-schools':   'trusted-schools',
}
const section = ref(routeMap[route.path] || 'dashboard')

function goSection(s) {
  const pathMap = {
    dashboard: '/super/dashboard',
    schools: '/super/schools',
    logs: '/super/logs',
    settings: '/super/settings',
    'contact-requests': '/super/contact-requests',
    'trusted-schools': '/super/trusted-schools',
  }
  router.push(pathMap[s] || '/super/dashboard')
}

watch(() => route.path, (p) => {
  const s = routeMap[p] || 'dashboard'
  section.value = s
  // Lazy-load data for the section that was just navigated to
  if (s === 'schools') fetchSchools()
  if (s === 'logs')    fetchLogs()
  if (s === 'dashboard' && !stats.value.totalSchools) fetchStats()
}, { immediate: false })

/* ── State ────────────────────────────────────────────────────────────── */
const stats          = ref({})
const schools        = ref([])
const activity       = ref([])
const logs           = ref([])
const loadingSchools = ref(false)
const loadingLogs    = ref(false)
let   pollInterval   = null

/* ── Nav ──────────────────────────────────────────────────────────────── */
const navSections = [
  { group: 'Overview',    items: [{ to: '/super/dashboard', label: 'Dashboard',         icon: 'dashboard' }] },
  { group: 'Management',  items: [{ to: '/super/schools',   label: 'Schools',           icon: 'school'    },
                                   { to: '/super/logs',      label: 'System Logs',       icon: 'log'       }] },
  { group: 'Website',     items: [{ to: '/super/contact-requests', label: 'Contact Requests', icon: 'bell' },
                                   { to: '/super/trusted-schools',  label: 'Trusted Schools',  icon: 'check-circle' }] },
  { group: 'System',      items: [{ to: '/super/settings',  label: 'Settings',          icon: 'settings'  }] },
]
const pageTitles = { dashboard: 'Dashboard', schools: 'Schools', logs: 'System Logs', settings: 'Settings', 'contact-requests': 'Contact Requests', 'trusted-schools': 'Trusted Schools' }
const currentPageTitle = computed(() => pageTitles[section.value] || 'Dashboard')

/* ── Data fetchers ────────────────────────────────────────────────────── */
// NOTE: api.js interceptor unwraps the { success, data, message } envelope,
// so the resolved value IS the inner data directly — no .data property needed.
async function fetchStats() {
  try {
    const r = await api.get('/super/stats')
    stats.value = (r && typeof r === 'object' && !Array.isArray(r)) ? r : {}
  } catch (e) { console.error('fetchStats', e) }
}

async function fetchSchools() {
  loadingSchools.value = true
  try {
    const r = await api.get('/schools')
    schools.value = Array.isArray(r) ? r : []
  } catch (e) { console.error('fetchSchools', e) }
  finally { loadingSchools.value = false }
}

async function fetchActivity() {
  try {
    const r = await api.get('/logs?limit=20')
    activity.value = Array.isArray(r) ? r : []
  } catch (e) { console.error('fetchActivity', e) }
}

async function fetchLogs() {
  loadingLogs.value = true
  try {
    const r = await api.get('/logs')
    logs.value = Array.isArray(r) ? r : []
  } catch (e) { console.error('fetchLogs', e) }
  finally { loadingLogs.value = false }
}

/* ── Lifecycle ────────────────────────────────────────────────────────── */
onMounted(async () => {
  // Load everything the current section needs + shared data
  const cur = routeMap[route.path] || 'dashboard'
  section.value = cur

  await Promise.all([fetchStats(), fetchSchools(), fetchActivity()])
  if (cur === 'logs') fetchLogs()

  // 30-second polling fallback for stats + activity (ensures data stays fresh)
  pollInterval = setInterval(() => {
    fetchStats()
    fetchActivity()
  }, 30000)

  const socket = getSocket()
  if (socket) {
    // School events
    socket.on('school_created',        () => { fetchSchools(); fetchStats(); fetchActivity() })
    socket.on('school_updated',        fetchSchools)
    socket.on('school_deleted',        () => { fetchSchools(); fetchStats(); fetchActivity() })
    socket.on('school_status_changed', () => { fetchSchools(); fetchActivity() })
    socket.on('attendance_marked',     fetchStats)
    // Real-time activity feed — triggered on every logAction() call in backend
    socket.on('activity_logged', () => {
      // Refresh the full activity list to get enriched data (user_name, etc.)
      fetchActivity()
    })
  }
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
  const socket = getSocket()
  if (socket) {
    socket.off('school_created')
    socket.off('school_updated')
    socket.off('school_deleted')
    socket.off('school_status_changed')
    socket.off('attendance_marked')
    socket.off('activity_logged')
  }
})
</script>
