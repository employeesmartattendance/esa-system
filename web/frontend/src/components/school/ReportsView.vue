<template>
  <div>
    <div class="section-header">
      <div>
        <h2 class="section-title">Attendance Reports</h2>
        <p class="section-desc">Daily attendance summaries generated automatically at end of day</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost btn-sm" @click="load" :disabled="loading">
          <AppIcon name="refresh" :size="15" />Refresh
        </button>
        <button class="btn btn-primary btn-sm" @click="generateToday" :disabled="generating">
          <div v-if="generating" class="spinner-sm"></div>
          <AppIcon v-else name="analytics" :size="15" />
          {{ generating ? 'Generating…' : 'Generate Today' }}
        </button>
      </div>
    </div>

    <!-- Summary cards (latest report) -->
    <div v-if="latestReport" class="summary-cards">
      <div class="glass summary-card">
        <div class="sc-icon" style="background:rgba(37,99,235,0.1)">
          <AppIcon name="teachers" :size="22" color="var(--primary)" />
        </div>
        <div class="sc-val">{{ latestReport.total_teachers }}</div>
        <div class="sc-lbl">Total Teachers</div>
      </div>
      <div class="glass summary-card">
        <div class="sc-icon" style="background:rgba(16,185,129,0.1)">
          <AppIcon name="check-circle" :size="22" color="var(--success)" />
        </div>
        <div class="sc-val" style="color:var(--success)">{{ latestReport.present_count }}</div>
        <div class="sc-lbl">Present</div>
      </div>
      <div class="glass summary-card">
        <div class="sc-icon" style="background:rgba(245,158,11,0.1)">
          <AppIcon name="clock" :size="22" color="var(--warning)" />
        </div>
        <div class="sc-val" style="color:var(--warning)">{{ latestReport.late_count }}</div>
        <div class="sc-lbl">Late</div>
      </div>
      <div class="glass summary-card">
        <div class="sc-icon" style="background:rgba(239,68,68,0.1)">
          <AppIcon name="x-circle" :size="22" color="var(--danger)" />
        </div>
        <div class="sc-val" style="color:var(--danger)">{{ latestReport.absent_count }}</div>
        <div class="sc-lbl">Absent</div>
      </div>
    </div>

    <!-- Reports table -->
    <div class="glass reports-table-wrap">
      <!-- Loading -->
      <div v-if="loading" class="rp-empty">
        <div class="spinner-lg"></div>
        <span style="color:var(--text-muted)">Loading reports...</span>
      </div>

      <!-- Empty -->
      <div v-else-if="reports.length === 0" class="rp-empty">
        <AppIcon name="analytics" :size="36" color="var(--text-muted)" />
        <p style="color:var(--text-muted);font-size:15px;font-weight:600">No reports yet</p>
        <p style="color:var(--text-muted);font-size:13px">Reports are auto-generated at 17:30 each day, or click "Generate Today".</p>
        <button class="btn btn-primary btn-sm" @click="generateToday" :disabled="generating">
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

        <div v-for="r in reports" :key="r.id" class="rp-row">
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
            <button class="btn btn-ghost btn-sm" @click="openDetail(r)">
              <AppIcon name="eye" :size="13" />Details
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <AppModal v-model="showDetail" :title="`Report — ${formatDate(selected?.report_date)}`" icon="analytics" max-width="560px">
      <div v-if="selected">
        <!-- Stats row -->
        <div class="detail-stats">
          <div class="ds-item" v-for="s in detailStats" :key="s.label">
            <div class="ds-val" :style="`color:${s.color}`">{{ s.val }}</div>
            <div class="ds-lbl">{{ s.label }}</div>
          </div>
        </div>

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
import AppIcon from '../ui/AppIcon.vue'
import AppModal from '../ui/AppModal.vue'
import api from '../../api'
import { useToast } from '../../composables/useToast'
import { getSocket } from '../../socket'

const { showToast } = useToast()
const reports    = ref([])
const loading    = ref(false)
const generating = ref(false)
const showDetail = ref(false)
const selected   = ref(null)

const latestReport = computed(() => reports.value[0] || null)

const detailStats = computed(() => selected.value ? [
  { val: selected.value.total_teachers, label: 'Total',   color: 'var(--primary)' },
  { val: selected.value.present_count,  label: 'Present', color: 'var(--success)' },
  { val: selected.value.late_count,     label: 'Late',    color: 'var(--warning)' },
  { val: selected.value.absent_count,   label: 'Absent',  color: 'var(--danger)'  },
] : [])

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
.section-title   { font-size:22px; font-weight:800; }
.section-desc    { font-size:13px; color:var(--text-muted); margin-top:2px; }
.header-actions  { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }

/* Summary cards */
.summary-cards { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:20px; }
.summary-card  { padding:18px 20px; border-radius:var(--radius-lg); display:flex; flex-direction:column; align-items:flex-start; gap:8px; }
.sc-icon { width:44px; height:44px; border-radius:var(--radius-sm); display:flex; align-items:center; justify-content:center; }
.sc-val  { font-size:32px; font-weight:900; color:var(--text); }
.sc-lbl  { font-size:12px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.04em; }

/* Table */
.reports-table-wrap { border-radius:var(--radius-lg); overflow:hidden; }
.rp-empty { display:flex; flex-direction:column; align-items:center; gap:14px; padding:56px 24px; text-align:center; }

.rp-table-header { display:grid; grid-template-columns:2fr 60px 80px 70px 80px 1fr 80px; gap:8px; padding:12px 20px; background:var(--bg-secondary); border-bottom:1px solid var(--surface-border); }
.rp-row          { display:grid; grid-template-columns:2fr 60px 80px 70px 80px 1fr 80px; gap:8px; padding:14px 20px; border-bottom:1px solid var(--surface-border); align-items:center; transition:background var(--transition); }
.rp-row:last-child { border-bottom:none; }
.rp-row:hover { background:rgba(37,99,235,0.03); }
.rp-col { display:flex; align-items:center; }
.rp-date { flex-direction:column; align-items:flex-start; gap:2px; }
.rp-date-main { font-size:14px; font-weight:700; }
.rp-date-sub  { font-size:11px; color:var(--text-muted); }
.rp-num  { justify-content:center; }
.rp-rate { flex-direction:column; align-items:flex-start; gap:4px; }
.rp-act  { justify-content:center; }
.rp-col.rp-date, .rp-col.rp-num, .rp-col.rp-rate, .rp-col.rp-act { font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em; }

.rp-badge { font-size:13px; font-weight:800; padding:3px 10px; border-radius:99px; }
.rp-badge.total   { background:rgba(37,99,235,0.1);   color:var(--primary); }
.rp-badge.present { background:rgba(16,185,129,0.12); color:var(--success); }
.rp-badge.late    { background:rgba(245,158,11,0.12); color:var(--warning); }
.rp-badge.absent  { background:rgba(239,68,68,0.1);   color:var(--danger);  }

.rate-bar-wrap { display:flex; align-items:center; gap:8px; width:100%; }
.rate-bar  { flex:1; height:6px; background:var(--bg-secondary); border-radius:99px; overflow:hidden; }
.rate-fill { height:100%; border-radius:99px; transition:width .5s ease; }
.rate-pct  { font-size:12px; font-weight:800; flex-shrink:0; }

/* Detail modal */
.detail-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
.ds-item { padding:14px; background:var(--bg-secondary); border-radius:var(--radius); text-align:center; border:1px solid var(--surface-border); }
.ds-val  { font-size:28px; font-weight:900; }
.ds-lbl  { font-size:11px; color:var(--text-muted); font-weight:700; text-transform:uppercase; margin-top:4px; }

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
  .summary-cards { grid-template-columns:repeat(2,1fr); }
  .rp-table-header { display:none; }
  .rp-row { display: flex; flex-direction: column; gap: 12px; padding: 20px; border-bottom: 1px solid var(--surface-border); }
  .rp-col { display: flex; justify-content: space-between; align-items: center; width: 100%; text-align: left; }
  .rp-col::before { content: attr(data-label); font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); }
  .rp-date { flex-direction: column; align-items: flex-start; gap: 2px; }
  .rp-date::before { content: "Date"; margin-bottom: 4px; }
  .rp-num, .rp-rate, .rp-act { border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px; }
  .detail-stats { grid-template-columns:repeat(2,1fr); }
}
</style>
