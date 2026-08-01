<template>
  <div class="insights-page">

    <div class="insights-header">
      <div>
        <h2 class="page-title">Absence Insights</h2>
        <p class="page-desc">See which {{ vocab.personNounPlural.toLowerCase() }} are missing or arriving late most often</p>
      </div>
      <button class="btn btn-ghost btn-sm" @click="load" :disabled="loading">
        <AppIcon name="refresh" :size="14" :class="{ spinning: loading }" />Refresh
      </button>
    </div>

    <!-- Range filter -->
    <div class="glass filters-bar">
      <div class="filter-group">
        <label class="filter-label"><AppIcon name="clock" :size="13" />From</label>
        <input v-model="range.start" type="date" class="form-input filter-input" />
      </div>
      <div class="filter-group">
        <label class="filter-label"><AppIcon name="clock" :size="13" />To</label>
        <input v-model="range.end" type="date" class="form-input filter-input" />
      </div>
      <div class="filter-actions">
        <button class="btn btn-primary btn-sm" @click="load" :disabled="loading">
          <AppIcon name="search" :size="14" />Apply
        </button>
      </div>
    </div>

    <!-- Summary stats -->
    <div class="stats-row">
      <div class="stat-card glass">
        <div class="stat-icon" style="background:rgba(37,99,235,0.12);color:var(--primary)"><AppIcon name="teachers" :size="18" /></div>
        <div>
          <div class="stat-val">{{ totalEmployees }}</div>
          <div class="stat-label">{{ vocab.personNounPlural }} Tracked</div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon" style="background:rgba(239,68,68,0.12);color:var(--danger)"><AppIcon name="x-circle" :size="18" /></div>
        <div>
          <div class="stat-val">{{ topAbsentCount }}</div>
          <div class="stat-label">Most Absences</div>
        </div>
      </div>
      <div class="stat-card glass">
        <div class="stat-icon" style="background:rgba(245,158,11,0.12);color:var(--warning)"><AppIcon name="alert-triangle" :size="18" /></div>
        <div>
          <div class="stat-val">{{ topLateCount }}</div>
          <div class="stat-label">Most Late Arrivals</div>
        </div>
      </div>
    </div>

    <!-- Tab switch -->
    <div class="tab-switch">
      <button class="tab-btn" :class="{ active: tab === 'absent' }" @click="tab = 'absent'">
        <AppIcon name="x-circle" :size="14" />Most Absent
      </button>
      <button class="tab-btn" :class="{ active: tab === 'late' }" @click="tab = 'late'">
        <AppIcon name="alert-triangle" :size="14" />Most Late
      </button>
    </div>

    <!-- List -->
    <div class="glass list-card">
      <div v-if="loading" class="loading-wrap">
        <div class="spinner-ring"><div></div><div></div><div></div><div></div></div>
        <span>Loading insights...</span>
      </div>

      <EmptyState
        v-else-if="!activeList.length"
        icon="attendance"
        :title="tab === 'absent' ? 'No absences in this range' : 'No late arrivals in this range'"
        :message="tab === 'absent'
          ? `Great news — no ${vocab.personNounPlural.toLowerCase()} have any absences in this date range.`
          : `Great news — no ${vocab.personNounPlural.toLowerCase()} have arrived late in this date range.`"
      />

      <div v-else class="rank-list">
        <div
          v-for="(e, idx) in activeList"
          :key="e.teacher_id"
          class="rank-row"
          :class="{ top: idx < 3 }"
        >
          <div class="rank-num" :class="`rank-${idx+1}`">{{ idx + 1 }}</div>

          <div class="rank-avatar">
            <img v-if="resolveAvatar(e.avatar)" :src="resolveAvatar(e.avatar)" :alt="e.name" class="rank-avatar-img" />
            <span v-else>{{ (e.name || '?').charAt(0) }}</span>
          </div>

          <div class="rank-info">
            <div class="rank-name">{{ e.name }}</div>
            <div class="rank-sub">{{ e.position || e.department || e.email }}</div>
          </div>

          <div class="rank-metrics">
            <template v-if="tab === 'absent'">
              <div class="rank-metric-main danger">{{ e.absent_count }}<span>absences</span></div>
              <div class="rank-rate">
                <div class="rate-bar"><div class="rate-fill" :style="`width:${e.absent_rate_relative}%;background:var(--danger)`"></div></div>
                <span class="rate-text">{{ e.absent_rate_relative }}% of most absent</span>
              </div>
            </template>
            <template v-else>
              <div class="rank-metric-main warning">{{ e.late_count }}<span>late</span></div>
              <!-- Red "late line": late percentage scaled relative to the
                   most-late-prone employee in this list, so it highlights
                   who is closest to being the one most likely to be
                   absent/late compared to others — not a flat rate. -->
              <div class="rank-rate">
                <div class="rate-bar"><div class="rate-fill rate-fill-late" :style="`width:${e.late_rate_relative}%`"></div></div>
                <span class="rate-text late-rate-text">{{ e.late_rate_relative }}% of most late</span>
              </div>
            </template>
          </div>
        </div>
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

function defaultRange() {
  const end = new Date()
  const start = new Date(); start.setDate(end.getDate() - 30)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

const range = ref(defaultRange())
const loading = ref(false)
const tab = ref('absent')
const mostAbsent = ref([])
const mostLate = ref([])
const totalEmployees = ref(0)

const activeList = computed(() => tab.value === 'absent' ? mostAbsent.value : mostLate.value)
const topAbsentCount = computed(() => mostAbsent.value[0]?.absent_count ?? 0)
const topLateCount = computed(() => mostLate.value[0]?.late_count ?? 0)

async function load() {
  loading.value = true
  try {
    const r = await api.get('/school/absence-insights', { params: { start_date: range.value.start, end_date: range.value.end } })
    const d = (r && typeof r === 'object') ? r : {}
    mostAbsent.value = Array.isArray(d.most_absent) ? d.most_absent : []
    mostLate.value = Array.isArray(d.most_late) ? d.most_late : []
    totalEmployees.value = d.total_employees || 0
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed to load insights')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.insights-page { display:flex; flex-direction:column; gap:16px; }
.insights-header { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px; }
.page-title { font-size:22px; font-weight:800; }
.page-desc  { font-size:13px; color:var(--text-muted); margin-top:4px; }

.filters-bar { display:flex; align-items:flex-end; gap:12px; padding:16px 20px; flex-wrap:wrap; }
.filter-group { display:flex; flex-direction:column; gap:5px; flex:1; min-width:140px; }
.filter-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); display:flex; align-items:center; gap:4px; }
.filter-input { width:100%; padding:8px 12px; font-size:13px; }
.filter-actions { display:flex; gap:8px; align-items:center; flex-shrink:0; }
.form-input { padding:10px 12px; background:var(--surface); border:1.5px solid var(--surface-border); border-radius:var(--radius-sm); color:var(--text); font-size:14px; font-family:var(--font); box-sizing:border-box; }

.stats-row { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.stat-card { display:flex; align-items:center; gap:12px; padding:16px 16px; border-radius:var(--radius); }
.stat-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.stat-val { font-size:22px; font-weight:800; line-height:1; }
.stat-label { font-size:11px; color:var(--text-muted); margin-top:3px; font-weight:600; }

.tab-switch { display:flex; gap:8px; padding:4px; background:var(--surface); border:1px solid var(--surface-border); border-radius:var(--radius); width:fit-content; }
.tab-btn {
  display:flex; align-items:center; gap:6px; padding:9px 16px; border-radius:var(--radius-sm);
  border:none; background:transparent; color:var(--text-muted); font-size:12.5px; font-weight:700;
  cursor:pointer; font-family:var(--font); transition:all 0.2s; white-space:nowrap;
}
.tab-btn.active { background:linear-gradient(135deg,var(--primary),var(--primary-dark)); color:#fff; box-shadow:0 3px 10px var(--primary-glow); }

.list-card { border-radius:var(--radius-lg); overflow:hidden; min-height:120px; }
.loading-wrap { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:40px 20px; color:var(--text-muted); font-size:13px; }
.spinner-ring { display:inline-block; position:relative; width:36px; height:36px; }
.spinner-ring div { position:absolute; width:28px; height:28px; margin:4px; border:3px solid var(--primary); border-radius:50%; animation:spinring 1.2s cubic-bezier(0.5,0,0.5,1) infinite; border-color:var(--primary) transparent transparent transparent; }
.spinner-ring div:nth-child(1) { animation-delay:-0.45s; }
.spinner-ring div:nth-child(2) { animation-delay:-0.3s; }
.spinner-ring div:nth-child(3) { animation-delay:-0.15s; }
@keyframes spinring { 0% { transform:rotate(0); } 100% { transform:rotate(360deg); } }

.rank-list { display:flex; flex-direction:column; }
.rank-row { display:flex; align-items:center; gap:12px; padding:14px 18px; border-bottom:1px solid var(--surface-border); }
.rank-row:last-child { border-bottom:none; }
.rank-row.top { background:rgba(239,68,68,0.02); }

.rank-num { width:26px; height:26px; border-radius:50%; background:var(--surface); border:1.5px solid var(--surface-border); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; color:var(--text-muted); flex-shrink:0; }
.rank-num.rank-1 { background:linear-gradient(135deg,#f59e0b,#d97706); border-color:transparent; color:#fff; }
.rank-num.rank-2 { background:linear-gradient(135deg,#94a3b8,#64748b); border-color:transparent; color:#fff; }
.rank-num.rank-3 { background:linear-gradient(135deg,#d97706,#92400e); border-color:transparent; color:#fff; }

.rank-avatar {
  width:40px; height:40px; border-radius:10px; flex-shrink:0;
  background:linear-gradient(135deg,var(--primary),var(--accent));
  display:flex; align-items:center; justify-content:center;
  color:#fff; font-size:14px; font-weight:800; overflow:hidden;
}
.rank-avatar-img { width:100%; height:100%; object-fit:cover; }

.rank-info { flex:1; min-width:0; }
.rank-name { font-size:13.5px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rank-sub { font-size:11.5px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.rank-metrics { display:flex; flex-direction:column; align-items:flex-end; gap:5px; flex-shrink:0; min-width:110px; }
.rank-metric-main { font-size:18px; font-weight:800; line-height:1; display:flex; align-items:baseline; gap:4px; }
.rank-metric-main span { font-size:10px; font-weight:600; color:var(--text-muted); text-transform:uppercase; }
.rank-metric-main.danger  { color:var(--danger); }
.rank-metric-main.warning { color:var(--warning); }
.rank-rate { display:flex; flex-direction:column; align-items:flex-end; gap:3px; width:100%; }
.rate-bar { width:100%; max-width:110px; height:4px; background:var(--surface-border); border-radius:99px; overflow:hidden; }
.rate-fill { height:100%; border-radius:99px; transition:width 0.6s ease; }
.rate-fill-late { background:var(--danger); }
.rate-text { font-size:10px; color:var(--text-muted); font-weight:600; }
.late-rate-text { color:var(--danger); font-weight:700; }

.spinning { animation:spin 1s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

/* ── Mobile-first responsive tuning ── */
@media (max-width:768px) {
  .insights-page { gap:12px; }
  .page-title { font-size:19px; }
  .insights-header { flex-direction:column; align-items:flex-start; }
  .filters-bar { flex-direction:column; padding:14px; gap:10px; }
  .filter-group { min-width:100%; }
  .filter-actions { width:100%; }
  .filter-actions .btn { flex:1; justify-content:center; }
  .stats-row { grid-template-columns:1fr; gap:8px; }
  .stat-card { padding:12px 14px; }
  .tab-switch { width:100%; }
  .tab-btn { flex:1; justify-content:center; padding:8px 10px; }
  .rank-row { padding:12px 14px; gap:10px; }
  .rank-avatar { width:34px; height:34px; font-size:12px; }
  .rank-num { width:22px; height:22px; font-size:11px; }
  .rank-metrics { min-width:80px; }
  .rank-metric-main { font-size:15px; }
}
@media (max-width:420px) {
  .rank-sub { display:none; }
  .rate-text { display:none; }
}
</style>
