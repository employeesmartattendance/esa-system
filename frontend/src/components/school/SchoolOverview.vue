<template>
  <div>
    <div class="stats-grid">
      <StatCard icon="teachers" label="Total Teachers" :value="stats.totalTeachers" value-color="var(--primary)" icon-color="var(--primary)" bg-color="rgba(37,99,235,0.1)" glow-color="rgba(37,99,235,0.08)" delay="0s" />
      <StatCard icon="check-circle" label="Present Today" :value="stats.presentToday" value-color="var(--success)" icon-color="var(--success)" bg-color="rgba(16,185,129,0.1)" glow-color="rgba(16,185,129,0.08)" delay="0.05s" />
      <StatCard icon="clock" label="Late Today" :value="stats.lateToday" value-color="var(--warning)" icon-color="var(--warning)" bg-color="rgba(245,158,11,0.1)" glow-color="rgba(245,158,11,0.08)" delay="0.1s" />
      <StatCard icon="x-circle" label="Absent Today" :value="stats.absentToday" value-color="var(--danger)" icon-color="var(--danger)" bg-color="rgba(239,68,68,0.1)" glow-color="rgba(239,68,68,0.08)" delay="0.15s" />
    </div>

    <div class="grid-2">
      <!-- Live teacher status -->
      <div class="glass section-card">
        <div class="card-header">
          <div class="card-title">
            <AppIcon name="live" :size="18" color="var(--success)" />
            Live Teacher Status
          </div>
          <div class="live-badge"><span class="pulse-dot"></span>Real-time</div>
        </div>
        <div v-if="teachers.length" class="teacher-status-list">
          <div v-for="t in teachers" :key="t.id" class="teacher-status-item">
            <div class="ts-avatar">{{ t.name?.charAt(0) }}</div>
            <div class="ts-info">
              <div class="ts-name">{{ t.name }}</div>
              <div class="ts-sub">{{ t.subject || 'Teacher' }}</div>
            </div>
            <div class="ts-right">
              <AppBadge :variant="t.today_status || 'absent'" :label="t.today_status || 'absent'" dot />
              <div class="ts-time">{{ t.check_in || '' }}</div>
            </div>
          </div>
        </div>
        <EmptyState v-else icon="teachers" title="No teachers" message="Add teachers to see live status" />
      </div>

      <!-- Recent attendance -->
      <div class="glass section-card">
        <div class="card-header">
          <div class="card-title"><AppIcon name="attendance" :size="18" color="var(--primary)" />Recent Check-ins</div>
          <button class="btn btn-ghost btn-sm" @click="$emit('go-attendance')">View All</button>
        </div>
        <div v-if="recentAttendance.length" class="recent-list">
          <div v-for="r in recentAttendance.slice(0,8)" :key="r.id" class="recent-item">
            <div class="recent-avatar">{{ r.teacher_name?.charAt(0) }}</div>
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
        <EmptyState v-else icon="attendance" title="No check-ins yet" message="Teachers' attendance will appear here" />
      </div>
    </div>
  </div>
</template>

<script setup>
import StatCard from '../ui/StatCard.vue'
import AppBadge from '../ui/AppBadge.vue'
import AppIcon from '../ui/AppIcon.vue'
import EmptyState from '../ui/EmptyState.vue'
defineProps({
  stats: { type: Object, default: () => ({}) },
  teachers: { type: Array, default: () => [] },
  recentAttendance: { type: Array, default: () => [] },
})
defineEmits(['go-attendance'])
</script>

<style scoped>
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
.section-card { padding: 22px; }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.card-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; }
.live-badge { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--success); font-weight: 600; }
.pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--success); animation: pulse 1.5s ease-in-out infinite; }
.teacher-status-list { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; }
.teacher-status-item { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: var(--radius-sm); background: rgba(37,99,235,0.03); border: 1px solid var(--surface-border); }
.ts-avatar { width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(135deg, var(--primary), var(--accent)); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; flex-shrink: 0; }
.ts-info { flex: 1; }
.ts-name { font-size: 13px; font-weight: 600; }
.ts-sub { font-size: 11px; color: var(--text-muted); }
.ts-right { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.ts-time { font-size: 11px; color: var(--text-muted); font-family: var(--mono); }
.recent-list { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; }
.recent-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-sm); transition: background var(--transition); }
.recent-item:hover { background: rgba(37,99,235,0.04); }
.recent-avatar { width: 30px; height: 30px; border-radius: 8px; background: linear-gradient(135deg, var(--primary), var(--accent)); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 700; flex-shrink: 0; }
.recent-name { font-size: 13px; font-weight: 600; }
.recent-meta { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.time-mono { font-size: 12px; font-family: var(--mono); color: var(--text-muted); }
.verify-dots { display: flex; gap: 3px; }
.dot { width: 16px; height: 16px; border-radius: 4px; font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.dot.ok  { background: rgba(16,185,129,0.15); color: var(--success); }
.dot.no  { background: rgba(239,68,68,0.15); color: var(--danger); }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
@media (max-width: 1024px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 768px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } .grid-2 { grid-template-columns: 1fr; } }
</style>
