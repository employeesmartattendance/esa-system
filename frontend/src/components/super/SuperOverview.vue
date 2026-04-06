<template>
  <div>
    <!-- Stats grid -->
    <div class="stats-grid">
      <StatCard icon="school" label="Total Schools" :value="stats.totalSchools" value-color="var(--primary)" icon-color="var(--primary)" bg-color="rgba(37,99,235,0.1)" glow-color="rgba(37,99,235,0.08)" delay="0s" />
      <StatCard icon="teachers" label="Total Teachers" :value="stats.totalTeachers" value-color="var(--accent)" icon-color="var(--accent)" bg-color="rgba(6,182,212,0.1)" glow-color="rgba(6,182,212,0.08)" delay="0.05s" />
      <StatCard icon="check-circle" label="Present Today" :value="stats.presentToday" value-color="var(--success)" icon-color="var(--success)" bg-color="rgba(16,185,129,0.1)" glow-color="rgba(16,185,129,0.08)" delay="0.1s" />
      <StatCard icon="alert-triangle" label="Absent Today" :value="stats.absentToday" value-color="var(--danger)" icon-color="var(--danger)" bg-color="rgba(239,68,68,0.1)" glow-color="rgba(239,68,68,0.08)" delay="0.15s" />
    </div>

    <!-- Charts row -->
    <div class="grid-2" style="margin-bottom:24px">
      <!-- Attendance rate donut -->
      <div class="glass section-card">
        <div class="card-header">
          <div class="card-title"><AppIcon name="analytics" :size="18" color="var(--primary)" />Attendance Rate Today</div>
        </div>
        <div class="donut-wrap">
          <svg class="donut-svg" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface-border)" stroke-width="12"/>
            <circle cx="60" cy="60" r="50" fill="none" stroke="url(#grad)" stroke-width="12"
              stroke-dasharray="314" :stroke-dashoffset="314 - (314 * attendanceRate / 100)"
              stroke-linecap="round" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 1s ease"/>
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="var(--primary)"/>
                <stop offset="100%" stop-color="var(--accent)"/>
              </linearGradient>
            </defs>
          </svg>
          <div class="donut-center">
            <div class="donut-val">{{ attendanceRate }}%</div>
            <div class="donut-label">Present</div>
          </div>
        </div>
        <div class="donut-legend">
          <div class="legend-item"><span class="legend-dot present"></span>Present ({{ stats.presentToday }})</div>
          <div class="legend-item"><span class="legend-dot late"></span>Late ({{ stats.lateToday ?? 0 }})</div>
          <div class="legend-item"><span class="legend-dot absent"></span>Absent ({{ stats.absentToday }})</div>
        </div>
      </div>

      <!-- Schools overview -->
      <div class="glass section-card">
        <div class="card-header">
          <div class="card-title"><AppIcon name="school" :size="18" color="var(--primary)" />Schools Overview</div>
          <button class="btn btn-ghost btn-sm" @click="$emit('go-schools')">
            View All <AppIcon name="trending-up" :size="13" />
          </button>
        </div>
        <div v-if="schools.length" class="school-list">
          <div v-for="sch in schools.slice(0,2)" :key="sch.id" class="school-item">
            <div class="school-item-left">
              <div class="sch-avatar">{{ sch.name?.charAt(0) }}</div>
              <div>
                <div class="sch-name">{{ sch.name }}</div>
                <div class="sch-meta">{{ sch.teacher_count }} teachers</div>
              </div>
            </div>
            <div class="school-item-right">
              <div class="sch-present">{{ sch.present_today ?? 0 }} present</div>
              <AppBadge :variant="sch.status === 'active' ? 'active' : 'inactive'" :label="sch.status" dot />
            </div>
          </div>
        </div>
        <EmptyState v-else icon="school" title="No schools" message="Create a school to see it here" />
      </div>
    </div>

    <!-- Activity + system -->
    <div class="grid-2">
      <div class="glass section-card">
        <div class="card-header">
          <div class="card-title"><AppIcon name="activity" :size="18" color="var(--primary)" />Recent Activity</div>
        </div>
        <div v-if="activity.length" class="activity-list">
          <div v-for="log in activity" :key="log.id" class="activity-item">
            <div class="activity-icon-wrap">
              <AppIcon name="log" :size="14" color="var(--primary)" />
            </div>
            <div class="activity-content">
              <div class="activity-action">{{ log.action }}</div>
              <div class="activity-meta">{{ log.user_name || 'System' }} · {{ timeAgo(log.timestamp) }}</div>
            </div>
          </div>
        </div>
        <EmptyState v-else icon="log" title="No activity yet" message="" />
      </div>

      <div class="glass section-card">
        <div class="card-header">
          <div class="card-title"><AppIcon name="shield" :size="18" :color="allOk ? 'var(--success)' : 'var(--danger)'" />System Status</div>
          <span class="status-live" :style="allOk ? '' : 'color:var(--danger)'">
            <span class="pulse-dot" :style="allOk ? '' : 'background:var(--danger)'"></span>
            {{ allOk ? 'All Systems Operational' : 'Issues Detected' }}
          </span>
        </div>
        <div class="system-checks">
          <div class="sys-check" v-for="c in systemChecks" :key="c.label">
            <div class="sys-check-left">
              <AppIcon :name="c.icon" :size="16" :color="c.ok === null ? 'var(--text-muted)' : c.ok ? 'var(--success)' : 'var(--danger)'" />
              <span>{{ c.label }}</span>
            </div>
            <AppBadge v-if="c.ok === null" variant="inactive" label="Checking…" dot />
            <AppBadge v-else :variant="c.ok ? 'active' : 'danger'" :label="c.ok ? 'Online' : 'Offline'" dot />
          </div>
        </div>
        <div class="quick-actions">
          <div class="card-header" style="margin-top:16px">
            <div class="card-title"><AppIcon name="activity" :size="16" color="var(--primary)" />Quick Actions</div>
          </div>
          <div class="qa-grid">
            <button class="qa-btn" @click="$emit('go-schools')">
              <AppIcon name="plus" :size="16" color="var(--primary)" />New School
            </button>
            <button class="qa-btn" @click="$emit('go-logs')">
              <AppIcon name="log" :size="16" color="var(--accent)" />View Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import StatCard from '../ui/StatCard.vue'
import AppBadge from '../ui/AppBadge.vue'
import AppIcon from '../ui/AppIcon.vue'
import EmptyState from '../ui/EmptyState.vue'
import { getSocket } from '../../socket'

const props = defineProps({
  stats: { type: Object, default: () => ({}) },
  schools: { type: Array, default: () => [] },
  activity: { type: Array, default: () => [] },
})
defineEmits(['go-schools', 'go-logs'])

const attendanceRate = computed(() => {
  const total = props.stats.totalTeachers || 0
  const present = props.stats.presentToday || 0
  if (!total) return 0
  return Math.round((present / total) * 100)
})

// ── Real System Status ──────────────────────────────────────────
const systemChecks = ref([
  { icon: 'activity', label: 'API Server',  ok: null },
  { icon: 'wifi',     label: 'Socket.io',   ok: null },
  { icon: 'layers',   label: 'Database',    ok: null },
  { icon: 'location', label: 'GPS Service', ok: true },  // mobile-side, always true
])

const allOk = computed(() => systemChecks.value.every(c => c.ok !== false))

const API = import.meta.env.VITE_API_URL || 'https://esa-system.onrender.com/api'

async function checkHealth() {
  try {
    const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(5000) })
    const d = await r.json()
    const health = d?.data || {}
    const socket = getSocket()
    systemChecks.value[0].ok = true                      // API responded
    systemChecks.value[1].ok = socket?.connected ?? false // Socket.io
    systemChecks.value[2].ok = health.database ?? false   // MongoDB
  } catch {
    // API unreachable
    systemChecks.value[0].ok = false
    systemChecks.value[1].ok = false
    systemChecks.value[2].ok = false
  }
}

let healthInterval = null
onMounted(() => {
  checkHealth()
  healthInterval = setInterval(checkHealth, 30000)
})
onUnmounted(() => { if (healthInterval) clearInterval(healthInterval) })

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
</script>

<style scoped>
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
.section-card { padding: 22px; }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.card-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; }

/* Donut */
.donut-wrap { position: relative; width: 140px; height: 140px; margin: 0 auto 16px; }
.donut-svg { width: 100%; height: 100%; }
.donut-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.donut-val { font-size: 26px; font-weight: 800; }
.donut-label { font-size: 12px; color: var(--text-muted); }
.donut-legend { display: flex; justify-content: center; gap: 16px; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-secondary); }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; }
.legend-dot.present { background: var(--success); }
.legend-dot.late    { background: var(--warning); }
.legend-dot.absent  { background: var(--danger); }

/* School list */
.school-list { display: flex; flex-direction: column; gap: 10px; }
.school-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: var(--radius-sm); background: rgba(37,99,235,0.03); border: 1px solid var(--surface-border); transition: background var(--transition); }
.school-item:hover { background: rgba(37,99,235,0.06); }
.school-item-left { display: flex; align-items: center; gap: 10px; }
.sch-avatar { width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(135deg, var(--primary), var(--accent)); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 14px; }
.sch-name { font-size: 13px; font-weight: 600; }
.sch-meta { font-size: 12px; color: var(--text-muted); }
.school-item-right { display: flex; align-items: center; gap: 8px; flex-direction: column; align-items: flex-end; }
.sch-present { font-size: 12px; color: var(--success); font-weight: 600; }

/* Activity */
.activity-list { display: flex; flex-direction: column; gap: 10px; max-height: 280px; overflow-y: auto; }
.activity-item { display: flex; align-items: flex-start; gap: 10px; }
.activity-icon-wrap { width: 30px; height: 30px; border-radius: 8px; background: rgba(37,99,235,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.activity-action { font-size: 13px; font-weight: 500; }
.activity-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

/* System */
.status-live { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--success); font-weight: 600; }
.pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--success); animation: pulse 1.5s ease-in-out infinite; }
.system-checks { display: flex; flex-direction: column; gap: 8px; }
.sys-check { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: var(--radius-sm); background: var(--surface); border: 1px solid var(--surface-border); }
.sys-check-left { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; }
.qa-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.qa-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--surface-border); background: var(--surface); font-size: 13px; font-weight: 600; color: var(--text-secondary); cursor: pointer; transition: all var(--transition); font-family: var(--font); }
.qa-btn:hover { border-color: var(--primary); color: var(--primary); background: rgba(37,99,235,0.06); }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
@media (max-width: 1024px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } .grid-2 { grid-template-columns: 1fr; } }
</style>
