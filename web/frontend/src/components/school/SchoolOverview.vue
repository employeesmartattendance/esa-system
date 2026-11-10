<template>
  <div>
    <AttendanceDistributionChart
      title="Today’s attendance"
      :subtitle="`${stats.totalTeachers || 0} ${vocab.personNounPlural.toLowerCase()} in this attendance breakdown`"
      :total="Number(stats.totalTeachers) || 0"
      :items="attendanceChartItems"
      :center-label="vocab.personNounPlural"
      period-label="Today"
    />

    <div class="grid-2">
      <!-- Live teacher status -->
      <div class="glass section-card">
        <div class="card-header">
          <div class="card-title">
            <AppIcon name="live" :size="18" color="var(--success)" />
            Live {{ vocab.personNoun }} Status
          </div>
          <div class="live-badge"><span class="pulse-dot"></span>Real-time</div>
        </div>
        <div v-if="teachers.length" class="teacher-status-list">
          <div v-for="t in teachers" :key="t.id" class="teacher-status-item">
            <div class="ts-avatar">
              <img v-if="resolveAvatar(t.avatar)" :src="resolveAvatar(t.avatar)" :alt="t.name" class="ts-avatar-img" />
              <span v-else>{{ t.name?.charAt(0) }}</span>
            </div>
            <div class="ts-info">
              <div class="ts-name">{{ t.name }}</div>
              <div class="ts-sub">{{ t.subject || vocab.personNoun }}</div>
            </div>
            <div class="ts-right">
              <AppBadge :variant="t.today_status || 'absent'" :label="t.today_status || 'absent'" dot />
              <div class="ts-time">{{ t.check_in || '' }}</div>
            </div>
          </div>
        </div>
        <EmptyState v-else icon="teachers" :title="`No ${vocab.personNounPlural.toLowerCase()}`" :message="`Add ${vocab.personNounPlural.toLowerCase()} to see live status`" />
      </div>

      <!-- Recent attendance -->
      <div class="glass section-card">
        <div class="card-header">
          <div class="card-title"><AppIcon name="attendance" :size="18" color="var(--primary)" />Recent Check-ins</div>
          <button class="btn btn-ghost btn-sm" @click="$emit('go-attendance')">View All</button>
        </div>
        <div v-if="recentAttendance.length" class="recent-list">
          <div v-for="r in recentAttendance.slice(0,8)" :key="r.id" class="recent-item">
            <div class="recent-avatar">
              <img v-if="resolveAvatar(r.avatar)" :src="resolveAvatar(r.avatar)" :alt="r.teacher_name" class="recent-avatar-img" />
              <span v-else>{{ r.teacher_name?.charAt(0) }}</span>
            </div>
            <div class="recent-info">
              <div class="recent-name">{{ r.teacher_name }}</div>
              <div class="recent-meta">
                <span class="time-mono">{{ r.check_in }}</span>
                <span class="verify-dots">
                  <span class="dot" :class="r.gps_valid ? 'ok' : 'no'" title="GPS">G</span>
                  <span class="dot" :class="r.wifi_valid ? 'ok' : 'no'" title="WiFi">W</span>
                </span>
              </div>
            </div>
            <AppBadge :variant="r.status" :label="r.status" dot />
          </div>
        </div>
        <EmptyState v-else icon="attendance" title="No check-ins yet" :message="`${vocab.personNounPlural}' attendance will appear here`" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AttendanceDistributionChart from '../ui/AttendanceDistributionChart.vue'
import AppBadge from '../ui/AppBadge.vue'
import AppIcon from '../ui/AppIcon.vue'
import EmptyState from '../ui/EmptyState.vue'
import { useIndustry } from '../../composables/useIndustry'
const props = defineProps({
  stats: { type: Object, default: () => ({}) },
  teachers: { type: Array, default: () => [] },
  recentAttendance: { type: Array, default: () => [] },
})
defineEmits(['go-attendance'])
const { vocab } = useIndustry()
const attendanceChartItems = computed(() => {
  const total = Math.max(0, Number(props.stats.totalTeachers) || 0)
  const present = Math.max(0, Number(props.stats.presentToday) || 0)
  const late = Math.max(0, Number(props.stats.lateToday) || 0)
  const absent = Math.max(0, Number(props.stats.absentToday) || 0)
  return [
    { label: 'Present', value: present, color: 'var(--success)' },
    { label: 'Late', value: late, color: 'var(--warning)' },
    { label: 'Absent', value: absent, color: 'var(--danger)' },
    { label: 'Not recorded', value: Math.max(0, total - present - late - absent), color: 'var(--text-muted)' },
  ]
})

const API = import.meta.env.VITE_API_URL || 'https://esa-system.onrender.com/api'
const apiBase = API.replace('/api', '')
function resolveAvatar(url) {
  if (!url) return null
  if (url.startsWith('http') || url.startsWith('//')) return url
  return `${apiBase}${url}`
}
</script>

<style scoped>
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
.section-card { padding: 22px; }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.card-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; }
.live-badge { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--success); font-weight: 600; }
.pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--success); animation: pulse 1.5s ease-in-out infinite; }
.teacher-status-list { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; }
.teacher-status-item { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: var(--radius-sm); background: rgba(37,99,235,0.03); border: 1px solid var(--surface-border); }
.ts-avatar { width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(135deg, var(--primary), var(--accent)); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; flex-shrink: 0; overflow: hidden; }
.ts-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ts-info { flex: 1; }
.ts-name { font-size: 13px; font-weight: 600; }
.ts-sub { font-size: 11px; color: var(--text-muted); }
.ts-right { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.ts-time { font-size: 11px; color: var(--text-muted); font-family: var(--mono); }
.recent-list { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; }
.recent-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-sm); transition: background var(--transition); }
.recent-item:hover { background: rgba(37,99,235,0.04); }
.recent-avatar { width: 30px; height: 30px; border-radius: 8px; background: linear-gradient(135deg, var(--primary), var(--accent)); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 700; flex-shrink: 0; overflow: hidden; }
.recent-avatar-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.recent-name { font-size: 13px; font-weight: 600; }
.recent-meta { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.time-mono { font-size: 12px; font-family: var(--mono); color: var(--text-muted); }
.verify-dots { display: flex; gap: 3px; }
.dot { width: 16px; height: 16px; border-radius: 4px; font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.dot.ok  { background: rgba(16,185,129,0.15); color: var(--success); }
.dot.no  { background: rgba(239,68,68,0.15); color: var(--danger); }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
@media (max-width: 768px) { .grid-2 { grid-template-columns: 1fr; } }
</style>
