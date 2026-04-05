<template>
  <DashboardLayout
    :navSections="navSections"
    :pageTitle="currentPageTitle"
    pageSubtitle="School Administration"
  >
    <Transition name="page" mode="out-in">
      <SchoolOverview
        v-if="section === 'dashboard'"
        key="overview"
        :stats="stats"
        :teachers="teachers"
        :recentAttendance="recentAttendance"
        @go-attendance="goSection('attendance')"
      />
      <TeachersManager
        v-else-if="section === 'teachers'"
        key="teachers"
        :teachers="teachers"
        :loading="loadingTeachers"
        :schoolId="auth.user?.school_id"
        @refresh="fetchTeachers"
      />
      <AttendanceView
        v-else-if="section === 'attendance'"
        key="attendance"
        :records="attendance"
        :teachers="teachers"
        :loading="loadingAttendance"
        @refresh="fetchAttendance"
      />
      <SettingsPanel
        v-else-if="section === 'settings'"
        key="settings"
        :schoolId="auth.user?.school_id"
      />
      <ReportsView
        v-else-if="section === 'reports'"
        key="reports"
      />
    </Transition>
  </DashboardLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashboardLayout   from '../components/layout/DashboardLayout.vue'
import SchoolOverview    from '../components/school/SchoolOverview.vue'
import TeachersManager   from '../components/school/TeachersManager.vue'
import AttendanceView    from '../components/school/AttendanceView.vue'
import SettingsPanel     from '../components/school/SettingsPanel.vue'
import ReportsView      from '../components/school/ReportsView.vue'
import { useAuthStore }  from '../stores/auth'
import { getSocket }     from '../socket'
import api from '../api'

const auth   = useAuthStore()
const route  = useRoute()
const router = useRouter()

/* ── Section ──────────────────────────────────────────────────────────── */
const routeMap = {
  '/school/dashboard':  'dashboard',
  '/school/teachers':   'teachers',
  '/school/attendance': 'attendance',
  '/school/settings':   'settings',
  '/school/reports':    'reports',
}
const section = ref(routeMap[route.path] || 'dashboard')

function goSection(s) {
  const pathMap = { dashboard:'/school/dashboard', teachers:'/school/teachers', attendance:'/school/attendance', settings:'/school/settings', reports:'/school/reports' }
  router.push(pathMap[s] || '/school/dashboard')
}

watch(() => route.path, (p) => {
  const s = routeMap[p] || 'dashboard'
  section.value = s
  if (s === 'teachers')   fetchTeachers()
  if (s === 'attendance') fetchAttendance()
  if (s === 'dashboard')  fetchStats()
}, { immediate: false })

/* ── State ────────────────────────────────────────────────────────────── */
const stats             = ref({})
const teachers          = ref([])
const attendance        = ref([])
const recentAttendance  = ref([])
const loadingTeachers   = ref(false)
const loadingAttendance = ref(false)

/* ── Nav ──────────────────────────────────────────────────────────────── */
const navSections = [
  { group: 'Overview',   items: [{ to: '/school/dashboard',  label: 'Dashboard',  icon: 'dashboard'  }] },
  { group: 'Management', items: [{ to: '/school/teachers',   label: 'Teachers',   icon: 'teachers'   },
                                  { to: '/school/attendance', label: 'Attendance', icon: 'attendance' }] },
  { group: 'Configure',  items: [{ to: '/school/settings',   label: 'Settings',   icon: 'settings'   }] },
  { group: 'Reports',    items: [{ to: '/school/reports',    label: 'Reports',    icon: 'analytics'  }] },
]
const pageTitles = { dashboard: 'Dashboard', teachers: 'Teachers', attendance: 'Attendance', settings: 'Settings', reports: 'Reports' }
const currentPageTitle = computed(() => pageTitles[section.value] || 'Dashboard')

/* ── Data fetchers ────────────────────────────────────────────────────── */
// NOTE: api.js interceptor unwraps the { success, data, message } envelope,
// so the resolved value IS the inner data directly — no .data property needed.
async function fetchStats() {
  try {
    const r = await api.get('/school/stats')
    stats.value = (r && typeof r === 'object' && !Array.isArray(r)) ? r : {}
  } catch (e) { console.error('fetchStats', e) }
}

async function fetchTeachers() {
  loadingTeachers.value = true
  try {
    const r = await api.get('/teachers')
    teachers.value = Array.isArray(r) ? r : []
  } catch (e) { console.error('fetchTeachers', e) }
  finally { loadingTeachers.value = false }
}

async function fetchAttendance() {
  loadingAttendance.value = true
  try {
    const r = await api.get('/attendance')
    const data = Array.isArray(r) ? r : []
    attendance.value       = data
    recentAttendance.value = data.slice(0, 10)
  } catch (e) { console.error('fetchAttendance', e) }
  finally { loadingAttendance.value = false }
}

/* ── Lifecycle ────────────────────────────────────────────────────────── */
onMounted(async () => {
  const cur = routeMap[route.path] || 'dashboard'
  section.value = cur

  await Promise.all([fetchStats(), fetchTeachers(), fetchAttendance()])

  const socket = getSocket()
  if (socket) {
    socket.on('attendance_marked',    () => { fetchStats(); fetchAttendance() })
    socket.on('teacher_updated',      fetchTeachers)
    socket.on('settings_updated',     fetchStats)
    socket.on('teacher_late_arrival', (data) => {
      import('../composables/useToast').then(m => m.useToast().showToast({
        type: 'warning',
        message: data?.message || 'A teacher arrived late'
      }))
    })
    socket.on('auto_checkout_complete', (data) => {
      fetchStats(); fetchAttendance()
      if (data?.count > 0) {
        import('../composables/useToast').then(m => m.useToast().info(`Auto checkout: ${data.count} teacher(s) checked out`))
      }
    })
  }
})

onUnmounted(() => {
  const socket = getSocket()
  if (socket) {
    socket.off('attendance_marked')
    socket.off('teacher_updated')
    socket.off('settings_updated')
    socket.off('teacher_late_arrival')
    socket.off('auto_checkout_complete')
  }
})
</script>
