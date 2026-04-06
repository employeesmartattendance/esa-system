<template>
  <div class="glass history-card">
    <div class="card-header">
      <div class="card-title"><AppIcon name="attendance" :size="18" color="var(--primary)" />Attendance History</div>
      <div class="month-nav">
        <button class="nav-btn" @click="prevMonth"><AppIcon name="filter" :size="14" /></button>
        <span class="month-label">{{ monthLabel }}</span>
        <button class="nav-btn" @click="nextMonth"><AppIcon name="filter" :size="14" /></button>
      </div>
    </div>

    <!-- Month summary -->
    <div class="month-summary">
      <div class="sum-item" v-for="s in monthlySummary" :key="s.label">
        <div class="sum-val" :style="`color:${s.color}`">{{ s.val }}</div>
        <div class="sum-label">{{ s.label }}</div>
      </div>
    </div>

    <!-- Records list -->
    <div v-if="monthRecords.length" class="records-list">
      <div v-for="r in monthRecords" :key="r.id" class="record-item">
        <div class="record-date">
          <div class="record-day">{{ dayNum(r.date) }}</div>
          <div class="record-weekday">{{ weekDay(r.date) }}</div>
        </div>
        <div class="record-info">
          <div class="record-times">
            <span class="time-in"><AppIcon name="checkin" :size="12" />{{ r.check_in || '—' }}</span>
            <span class="time-sep">→</span>
            <span class="time-out"><AppIcon name="checkout" :size="12" />{{ r.check_out || '—' }}</span>
          </div>
          <div class="record-verify">
            <span class="v-chip" :class="r.gps_valid ? 'ok' : 'no'"><AppIcon name="location" :size="10" />GPS</span>
            <span class="v-chip" :class="r.wifi_valid ? 'ok' : 'no'"><AppIcon name="wifi" :size="10" />WiFi</span>
          </div>
        </div>
        <AppBadge :variant="r.status" :label="r.status" dot />
      </div>
    </div>
    <EmptyState v-else icon="attendance" title="No records this month" message="Check-in records will appear here" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import AppBadge from '../ui/AppBadge.vue'
import EmptyState from '../ui/EmptyState.vue'

const props = defineProps({ records: { type: Array, default: () => [] } })

const currentDate = ref(new Date())

const monthLabel = computed(() => currentDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))

const monthRecords = computed(() => {
  const y = currentDate.value.getFullYear()
  const m = currentDate.value.getMonth()
  return props.records.filter(r => {
    const d = new Date(r.date)
    return d.getFullYear() === y && d.getMonth() === m
  }).sort((a, b) => new Date(b.date) - new Date(a.date))
})

const monthlySummary = computed(() => {
  const r = monthRecords.value
  return [
    { label: 'Present', val: r.filter(x => x.status === 'present').length, color: 'var(--success)' },
    { label: 'Late', val: r.filter(x => x.status === 'late').length, color: 'var(--warning)' },
    { label: 'Absent', val: r.filter(x => x.status === 'absent').length, color: 'var(--danger)' },
    { label: 'Total', val: r.length, color: 'var(--primary)' },
  ]
})

function prevMonth() { currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1) }
function nextMonth() { currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1) }
function dayNum(d) { return new Date(d).getDate() }
function weekDay(d) { return new Date(d).toLocaleDateString('en-US', { weekday: 'short' }) }
</script>

<style scoped>
.history-card { padding: 22px; border-radius: var(--radius-lg); }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.card-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; }
.month-nav { display: flex; align-items: center; gap: 8px; }
.nav-btn { width: 28px; height: 28px; border-radius: var(--radius-sm); border: 1px solid var(--surface-border); background: var(--surface); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all var(--transition); }
.nav-btn:hover { border-color: var(--primary); color: var(--primary); }
.month-label { font-size: 14px; font-weight: 600; min-width: 130px; text-align: center; }
.month-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
.sum-item { text-align: center; padding: 10px; background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-sm); }
.sum-val { font-size: 22px; font-weight: 800; line-height: 1; }
.sum-label { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.records-list { display: flex; flex-direction: column; gap: 6px; max-height: 400px; overflow-y: auto; padding-right: 4px; }
.record-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--radius-sm); background: rgba(37,99,235,0.03); border: 1px solid var(--surface-border); transition: background var(--transition); }
.record-item:hover { background: rgba(37,99,235,0.06); }
.record-date { text-align: center; min-width: 36px; }
.record-day { font-size: 18px; font-weight: 800; line-height: 1; }
.record-weekday { font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; }
.record-info { flex: 1; }
.record-times { display: flex; align-items: center; gap: 6px; font-size: 13px; font-family: var(--mono); font-weight: 600; flex-wrap: wrap; }
.time-in { color: var(--success); display: flex; align-items: center; gap: 3px; }
.time-out { color: var(--warning); display: flex; align-items: center; gap: 3px; }
.time-sep { color: var(--text-muted); }
.record-verify { display: flex; gap: 4px; margin-top: 4px; }
.v-chip { display: flex; align-items: center; gap: 3px; padding: 2px 6px; border-radius: 99px; font-size: 10px; font-weight: 600; }
.v-chip.ok  { background: rgba(16,185,129,0.12); color: var(--success); }
.v-chip.no  { background: rgba(239,68,68,0.12); color: var(--danger); }
</style>
