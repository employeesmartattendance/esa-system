<template>
  <div class="reports-page">
    <MobilePageHero title="Attendance reports" subtitle="Review daily attendance summaries and trends" />
    <div class="section-header">
      <div>
        <h2 class="section-title">Attendance Reports</h2>
        <p class="section-desc">Daily attendance summaries generated automatically at end of day</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost btn-sm" @click="load" :disabled="loading">
          <AppIcon name="refresh" :size="15" />Refresh
        </button>
        <button class="btn btn-primary btn-sm btn-generate" @click="generateToday" :disabled="generating">
          <div v-if="generating" class="spinner-sm"></div>
          <AppIcon v-else name="analytics" :size="15" />
          {{ generating ? 'Generating…' : 'Generate Today' }}
        </button>
      </div>
    </div>

    <!-- Latest report is presented as a visual attendance breakdown, not KPI tiles. -->
    <AttendanceDistributionChart
      v-if="latestReport"
      title="Latest attendance report"
      :subtitle="`${latestReport.total_teachers || 0} ${vocab.personNounPlural.toLowerCase()} in the latest report`"
      :total="Number(latestReport.total_teachers) || 0"
      :items="latestReportChartItems"
      :center-label="vocab.personNounPlural"
      :period-label="formatDate(latestReport.report_date)"
    />

    <div class="mobile-report-filters" role="tablist" aria-label="Filter attendance reports">
      <button
        v-for="filter in reportFilters"
        :key="filter.value"
        type="button"
        class="mobile-report-filter"
        :class="{ active: activeReportFilter === filter.value }"
        :aria-selected="activeReportFilter === filter.value"
        @click="activeReportFilter = filter.value; expandedReportKey = null"
      >{{ filter.label }}</button>
    </div>

    <!-- Reports table -->
    <div class="glass reports-table-wrap">
      <!-- Loading -->
      <div v-if="loading && !hasLoadedOnce && !reports.length && showDelayedLoading" class="rp-empty">
        <div class="spinner-lg"></div>
        <span style="color:var(--text-muted)">Loading reports...</span>
      </div>

      <div v-else-if="loading && !hasLoadedOnce && !reports.length" class="rp-empty rp-loading-reserve"></div>

      <!-- Empty -->
      <div v-else-if="!filteredReports.length" class="rp-empty">
        <AppIcon name="analytics" :size="36" color="var(--text-muted)" />
        <p style="color:var(--text-muted);font-size:15px;font-weight:600">{{ reports.length ? 'No reports match this filter' : 'No reports yet' }}</p>
        <p v-if="!reports.length" style="color:var(--text-muted);font-size:13px">Reports are auto-generated at 17:30 each day, or click "Generate Today".</p>
        <button v-if="!reports.length" class="btn btn-primary btn-sm" @click="generateToday" :disabled="generating">
          Generate Today's Report
        </button>
      </div>

      <!-- Table -->
      <div v-else>
        <div class="rp-table-header">
          <div class="rp-col rp-date">Date</div>
          <div class="rp-col rp-num">Total</div>
          <div class="rp-col rp-num present">Present</div>
          <div class="rp-col rp-num late">Late</div>
          <div class="rp-col rp-num absent">Absent</div>
          <div class="rp-col rp-rate">Rate</div>
          <div class="rp-col rp-act">Details</div>
        </div>

        <div
          v-for="r in filteredReports"
          :key="r.id || r.report_date"
          class="rp-row"
          :class="{ 'is-expanded': expandedReportKey === reportKey(r) }"
        >
          <div class="rp-col rp-date">
            <div class="rp-date-main">{{ formatDate(r.report_date) }}</div>
            <div class="rp-date-sub">{{ dayLabel(r.report_date) }}</div>
          </div>
          <div class="rp-col rp-num" data-label="Total"><span class="rp-badge total">{{ r.total_teachers }}</span></div>
          <div class="rp-col rp-num" data-label="Present"><span class="rp-badge present">{{ r.present_count }}</span></div>
          <div class="rp-col rp-num" data-label="Late"><span class="rp-badge late">{{ r.late_count }}</span></div>
          <div class="rp-col rp-num" data-label="Absent"><span class="rp-badge absent">{{ r.absent_count }}</span></div>
          <div class="rp-col rp-rate" data-label="Rate">
            <div class="rate-bar-wrap">
              <div class="rate-bar">
                <div class="rate-fill" :style="`width:${attendanceRate(r)}%;background:${rateColor(attendanceRate(r))}`"></div>
              </div>
              <span class="rate-pct" :style="`color:${rateColor(attendanceRate(r))}`">{{ attendanceRate(r) }}%</span>
            </div>
          </div>
          <div class="rp-col rp-act" data-label="Actions">
            <button class="btn btn-primary btn-sm" @click="openDetail(r)">
              <AppIcon name="eye" :size="13" />View more
            </button>
            <button class="btn btn-ghost btn-sm" @click="toggleReportExpanded(r)">
              <AppIcon :name="expandedReportKey === reportKey(r) ? 'chevron-up' : 'chevron-down'" :size="13" />
              {{ expandedReportKey === reportKey(r) ? 'Less' : 'Details' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <AppModal v-model="showDetail" :title="`Report — ${formatDate(selected?.report_date)}`" icon="analytics" max-width="560px">
      <div v-if="selected">
        <AttendanceDistributionChart
          title="Report breakdown"
          :subtitle="`${selected.total_teachers || 0} ${vocab.personNounPlural.toLowerCase()} recorded`"
          :total="Number(selected.total_teachers) || 0"
          :items="selectedReportChartItems"
          :center-label="vocab.personNounPlural"
          :period-label="formatDate(selected.report_date)"
        />

        <!-- Name lists -->
        <div class="name-lists">
          <div class="name-section" v-if="selected.present_names?.length">
            <div class="nl-header present-h">
              <AppIcon name="check-circle" :size="14" color="var(--success)" />
              Present ({{ selected.present_names.length }})
            </div>
            <div class="nl-names">
              <span class="nl-tag present-t" v-for="n in selected.present_names" :key="n">{{ n }}</span>
            </div>
          </div>

          <div class="name-section" v-if="selected.late_names?.length">
            <div class="nl-header late-h">
              <AppIcon name="clock" :size="14" color="var(--warning)" />
              Late ({{ selected.late_names.length }})
            </div>
            <div class="nl-names">
              <span class="nl-tag late-t" v-for="n in selected.late_names" :key="n">{{ n }}</span>
            </div>
          </div>

          <div class="name-section" v-if="selected.absent_names?.length">
            <div class="nl-header absent-h">
              <AppIcon name="x-circle" :size="14" color="var(--danger)" />
              Absent ({{ selected.absent_names.length }})
            </div>
            <div class="nl-names">
              <span class="nl-tag absent-t" v-for="n in selected.absent_names" :key="n">{{ n }}</span>
            </div>
          </div>
        </div>

        <div style="margin-top:16px;font-size:12px;color:var(--text-muted);text-align:right">
          Generated: {{ formatFull(selected.generated_at) }}
        </div>
      </div>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import MobilePageHero from '../ui/MobilePageHero.vue'
import AttendanceDistributionChart from '../ui/AttendanceDistributionChart.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppModal from '../ui/AppModal.vue'
import api from '../../api'
import { useToast } from '../../composables/useToast'
import { getSocket } from '../../socket'
import { useDelayedLoading } from '../../composables/useDelayedLoading'
import { useIndustry } from '../../composables/useIndustry'
const { vocab } = useIndustry()

const { showToast } = useToast()
const reports    = ref([])
const loading    = ref(false)
const generating = ref(false)
const hasLoadedOnce = ref(false)
const showDelayedLoading = useDelayedLoading(() => loading.value, 180)
const showDetail = ref(false)
const selected   = ref(null)
const activeReportFilter = ref('all')
const expandedReportKey = ref(null)

const latestReport = computed(() => reports.value[0] || null)
const reportFilters = [
  { value: 'all', label: 'All reports' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'older', label: 'Older' },
]
const filteredReports = computed(() => {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setHours(0, 0, 0, 0)
  const day = (startOfWeek.getDay() + 6) % 7
  startOfWeek.setDate(startOfWeek.getDate() - day)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return reports.value.filter(report => {
    if (activeReportFilter.value === 'all') return true
    const date = new Date(report.report_date)
    if (Number.isNaN(date.getTime())) return activeReportFilter.value === 'older'
    if (activeReportFilter.value === 'week') return date >= startOfWeek
    if (activeReportFilter.value === 'month') return date >= startOfMonth
    return date < startOfMonth
  })
})
const latestReportChartItems = computed(() => reportChartItems(latestReport.value))
const selectedReportChartItems = computed(() => reportChartItems(selected.value))

function reportChartItems(report) {
  if (!report) return []
  const total = Math.max(0, Number(report.total_teachers) || 0)
  const present = Math.max(0, Number(report.present_count) || 0)
  const late = Math.max(0, Number(report.late_count) || 0)
  const absent = Math.max(0, Number(report.absent_count) || 0)
  return [
    { label: 'Present', value: present, color: 'var(--success)' },
    { label: 'Late', value: late, color: 'var(--warning)' },
    { label: 'Absent', value: absent, color: 'var(--danger)' },
    { label: 'Not recorded', value: Math.max(0, total - present - late - absent), color: 'var(--text-muted)' },
  ]
}
function reportKey(report) { return String(report?.id ?? report?.report_date ?? '') }
function toggleReportExpanded(report) {
  const key = reportKey(report)
  expandedReportKey.value = expandedReportKey.value === key ? null : key
}


onMounted(() => {
  load()
  // Listen for real-time report_generated event from backend
  const socket = getSocket()
  if (socket) {
    socket.on('report_generated', () => {
      load() // auto-refresh the list
    })
  }
})

onUnmounted(() => {
  const socket = getSocket()
  if (socket) socket.off('report_generated')
})

async function load() {
  loading.value = true
  try {
    const r = await api.get('/school/reports')
    reports.value = Array.isArray(r?.reports) ? r.reports : (Array.isArray(r) ? r : [])
  } catch {
    showToast({ type: 'error', message: 'Failed to load reports' })
  } finally {
    loading.value = false
    hasLoadedOnce.value = true
  }
}

async function generateToday() {
  generating.value = true
  try {
    await api.post('/school/reports/generate')
    showToast({ type: 'success', message: "Today's report generated successfully" })
  } catch (e) {
    const msg = e?.response?.data?.message || 'Generation failed'
    // Show warning but still reload — partial data may exist
    showToast({ type: msg.includes('No attendance') ? 'warning' : 'error', message: msg })
  } finally {
    // Always reload list regardless of success/error
    await load()
    generating.value = false
  }
}

function openDetail(r) {
  selected.value = r
  showDetail.value = true
}

function attendanceRate(r) {
  if (!r.total_teachers) return 0
  return Math.round(((r.present_count + r.late_count) / r.total_teachers) * 100)
}

function rateColor(pct) {
  if (pct >= 85) return 'var(--success)'
  if (pct >= 65) return 'var(--warning)'
  return 'var(--danger)'
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatFull(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function dayLabel(d) {
  if (!d) return ''
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  const date = new Date(d)
  if (date.toDateString() === today)     return 'Today'
  if (date.toDateString() === yesterday) return 'Yesterday'
  return date.toLocaleDateString('en-GB', { weekday: 'long' })
}
</script>

<style scoped>
.section-header  { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:10px; }
/* Override the global translateY hover for this button — it sits at the
   very top of the scroll area, so moving it upward on hover could clip
   under the topbar. Use a non-shifting scale + glow effect instead
   (matches the "+ New Company" button on the super admin Companies page). */
.btn.btn-primary.btn-generate:hover:not(:disabled) {
  transform: scale(1.035);
  box-shadow: 0 6px 22px var(--primary-glow);
}
.btn.btn-primary.btn-generate:active:not(:disabled) {
  transform: scale(0.98);
}
.section-title   { font-size:22px; font-weight:800; }
.section-desc    { font-size:13px; color:var(--text-muted); margin-top:2px; }
.header-actions  { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }

.reports-page { display:flex; flex-direction:column; gap:16px; }
.rp-loading-reserve { min-height:20px; padding:12px; }
.mobile-report-filters { display:none; }

/* Table */
.reports-table-wrap { border-radius:var(--radius-lg); overflow:hidden; }
.rp-empty { display:flex; flex-direction:column; align-items:center; gap:14px; padding:56px 24px; text-align:center; }

.rp-table-header { display:grid; grid-template-columns:2fr 60px 80px 70px 80px 1fr 80px; gap:8px; padding:12px 20px; background:rgba(37,99,235,0.08); border-bottom:1px solid var(--surface-border); }
.rp-row          { display:grid; grid-template-columns:2fr 60px 80px 70px 80px 1fr 80px; gap:8px; padding:14px 20px; border-bottom:1px solid var(--surface-border); align-items:center; transition:background var(--transition); }
.rp-row:last-child { border-bottom:none; }
.rp-row:hover { background:rgba(37,99,235,0.03); }
.rp-col { display:flex; align-items:center; }
.rp-date { flex-direction:column; align-items:flex-start; gap:2px; }
.rp-date-main { font-size:14px; font-weight:700; color:var(--text); }
.rp-date-sub  { font-size:11px; color:var(--primary); font-weight:600; }
.rp-num  { justify-content:center; }
.rp-rate { flex-direction:column; align-items:flex-start; gap:4px; }
.rp-act  { justify-content:center; }
.rp-col.rp-date, .rp-col.rp-num, .rp-col.rp-rate, .rp-col.rp-act { font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em; }
.rp-table-header .rp-col { color:var(--primary); }

.rp-badge { font-size:13px; font-weight:800; padding:3px 10px; border-radius:99px; }
.rp-badge.total   { background:rgba(37,99,235,0.1);   color:var(--primary); }
.rp-badge.present { background:rgba(16,185,129,0.12); color:var(--success); }
.rp-badge.late    { background:rgba(245,158,11,0.12); color:var(--warning); }
.rp-badge.absent  { background:rgba(239,68,68,0.1);   color:var(--danger);  }

.rate-bar-wrap { display:flex; align-items:center; gap:8px; width:100%; }
.rate-bar  { flex:1; height:6px; background:var(--bg-secondary); border-radius:99px; overflow:hidden; }
.rate-fill { height:100%; border-radius:99px; transition:width .5s ease; }
.rate-pct  { font-size:12px; font-weight:800; flex-shrink:0; }

/* Report details inside the shared mobile bottom sheet. */

.name-lists { display:flex; flex-direction:column; gap:14px; }
.name-section { border-radius:var(--radius); overflow:hidden; }
.nl-header { display:flex; align-items:center; gap:8px; padding:10px 14px; font-size:13px; font-weight:700; }
.present-h { background:rgba(16,185,129,0.12); color:var(--success); }
.late-h    { background:rgba(245,158,11,0.12); color:var(--warning); }
.absent-h  { background:rgba(239,68,68,0.1);   color:var(--danger);  }
.nl-names  { display:flex; flex-wrap:wrap; gap:6px; padding:12px 14px; background:var(--bg); }
.nl-tag    { font-size:12px; font-weight:600; padding:3px 10px; border-radius:99px; }
.present-t { background:rgba(16,185,129,0.12); color:var(--success); }
.late-t    { background:rgba(245,158,11,0.12); color:var(--warning); }
.absent-t  { background:rgba(239,68,68,0.1);   color:var(--danger);  }

.spinner-sm { width:14px; height:14px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; }
.spinner-lg { width:28px; height:28px; border:3px solid rgba(37,99,235,.2); border-top-color:var(--primary); border-radius:50%; animation:spin .8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

@media (max-width:768px) {
  .mobile-report-filters { display:flex; gap:8px; overflow-x:auto; padding:1px 0 4px; margin:0 -1px; scrollbar-width:none; overscroll-behavior-x:contain; }
  .mobile-report-filters::-webkit-scrollbar { display:none; }
  .mobile-report-filter { flex:0 0 auto; white-space:nowrap; border:1px solid var(--surface-border); border-radius:999px; background:var(--surface); color:var(--text-secondary); padding:8px 14px; font:600 12px var(--font); }
  .mobile-report-filter.active { color:#fff; background:var(--primary); border-color:var(--primary); box-shadow:0 4px 12px rgba(37,99,235,.2); }
  .rp-table-header { display:none; }
  .rp-row { display:grid; grid-template-columns:1fr 1fr; gap:10px 12px; margin:0 0 10px; padding:14px; border:1px solid var(--surface-border); border-radius:16px; background:var(--surface); box-shadow:0 4px 16px rgba(15,23,42,.045); }
  .rp-col { display:flex; justify-content:space-between; align-items:center; width:100%; min-width:0; text-align:left; }
  .rp-col::before { content:attr(data-label); font-size:10px; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:.04em; }
  .rp-date { grid-column:1 / -1; flex-direction:column; align-items:flex-start; gap:2px; border-bottom:1px solid var(--surface-border); padding-bottom:9px; }
  .rp-date::before { content:"Report date"; margin-bottom:3px; }
  .rp-num[data-label="Total"], .rp-num[data-label="Present"] { display:flex; }
  .rp-num[data-label="Late"], .rp-num[data-label="Absent"], .rp-rate { display:none; }
  .rp-row.is-expanded .rp-num[data-label="Late"], .rp-row.is-expanded .rp-num[data-label="Absent"], .rp-row.is-expanded .rp-rate { display:flex; }
  .rp-num, .rp-rate { border-top:1px solid var(--surface-border); padding-top:9px; }
  .rp-act { grid-column:1 / -1; display:grid; grid-template-columns:1fr 1fr; gap:8px; border-top:1px solid var(--surface-border); padding-top:10px; }
  .rp-act::before { display:none; }
  .rp-act .btn { min-height:38px; justify-content:center; white-space:nowrap; }
  .reports-table-wrap { background:transparent; border:0; box-shadow:none; overflow:visible; }
  .rp-row .rp-col.rp-act { background:transparent; }
}
</style>
