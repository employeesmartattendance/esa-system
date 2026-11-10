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

    <!-- Monthly attendance is summarized as a distribution diagram. -->
    <AttendanceDistributionChart
      title="Monthly attendance"
      subtitle="Your recorded attendance for this month"
      :total="monthRecords.length"
      :items="monthlyChartItems"
      center-label="Records"
      :period-label="monthLabel"
    />

    <div class="history-filters" role="tablist" aria-label="Filter monthly attendance">
      <button
        v-for="filter in historyFilters"
        :key="filter.value"
        type="button"
        class="history-filter"
        :class="{ active: activeFilter === filter.value }"
        :aria-selected="activeFilter === filter.value"
        @click="activeFilter = filter.value; expandedRecordId = null"
      >{{ filter.label }}</button>
    </div>

    <!-- Compact records with expandable details on mobile. -->
    <div v-if="filteredMonthRecords.length" class="records-list">
      <article
        v-for="r in filteredMonthRecords"
        :key="recordKey(r)"
        class="record-item"
        :class="{ 'is-expanded': expandedRecordId === recordKey(r) }"
      >
        <div class="record-main">
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
          <AppBadge :variant="r.status" :label="r.status || 'Recorded'" dot />
        </div>

        <div v-if="expandedRecordId === recordKey(r)" class="record-expanded">
          <div><span>Date</span><strong>{{ new Date(r.date).toLocaleDateString() }}</strong></div>
          <div><span>Status</span><strong>{{ r.status || 'Recorded' }}</strong></div>
          <div><span>Check in</span><strong>{{ r.check_in || '—' }}</strong></div>
          <div><span>Check out</span><strong>{{ r.check_out || '—' }}</strong></div>
          <div><span>GPS verification</span><strong>{{ r.gps_valid ? 'Verified' : 'Not verified' }}</strong></div>
          <div><span>Wi-Fi verification</span><strong>{{ r.wifi_valid ? 'Verified' : 'Not verified' }}</strong></div>
        </div>

        <div class="record-actions">
          <button type="button" class="btn btn-primary btn-sm" @click="openRecordDetails(r)">View more</button>
          <button type="button" class="btn btn-ghost btn-sm" @click="toggleRecord(r)">
            {{ expandedRecordId === recordKey(r) ? 'Less' : 'Details' }}
          </button>
        </div>
      </article>
    </div>
    <EmptyState
      v-else
      icon="attendance"
      :title="monthRecords.length ? 'No matching records' : 'No records this month'"
      :message="monthRecords.length ? 'Try another attendance filter' : 'Check-in records will appear here'"
    />

    <AppModal v-model="showRecordModal" title="Attendance record" icon="attendance" max-width="440px">
      <div v-if="selectedRecord" class="record-modal-details">
        <div><span>Date</span><strong>{{ new Date(selectedRecord.date).toLocaleDateString() }}</strong></div>
        <div><span>Status</span><strong>{{ selectedRecord.status || 'Recorded' }}</strong></div>
        <div><span>Check in</span><strong>{{ selectedRecord.check_in || '—' }}</strong></div>
        <div><span>Check out</span><strong>{{ selectedRecord.check_out || '—' }}</strong></div>
        <div><span>GPS verification</span><strong>{{ selectedRecord.gps_valid ? 'Verified' : 'Not verified' }}</strong></div>
        <div><span>Wi-Fi verification</span><strong>{{ selectedRecord.wifi_valid ? 'Verified' : 'Not verified' }}</strong></div>
      </div>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import AppBadge from '../ui/AppBadge.vue'
import EmptyState from '../ui/EmptyState.vue'
import AppModal from '../ui/AppModal.vue'
import AttendanceDistributionChart from '../ui/AttendanceDistributionChart.vue'

const props = defineProps({ records: { type: Array, default: () => [] } })

const currentDate = ref(new Date())
const activeFilter = ref('all')
const expandedRecordId = ref(null)
const showRecordModal = ref(false)
const selectedRecord = ref(null)
const historyFilters = [
  { value: 'all', label: 'All' },
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
]

const monthLabel = computed(() => currentDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }))

const monthRecords = computed(() => {
  const y = currentDate.value.getFullYear()
  const m = currentDate.value.getMonth()
  return props.records.filter(r => {
    const d = new Date(r.date)
    return d.getFullYear() === y && d.getMonth() === m
  }).sort((a, b) => new Date(b.date) - new Date(a.date))
})

const monthlyChartItems = computed(() => {
  const counts = { present: 0, late: 0, absent: 0, other: 0 }
  for (const record of monthRecords.value) {
    const status = String(record.status || '').toLowerCase()
    if (status === 'present') counts.present++
    else if (status === 'late') counts.late++
    else if (status === 'absent') counts.absent++
    else counts.other++
  }
  return [
    { label: 'Present', value: counts.present, color: 'var(--success)' },
    { label: 'Late', value: counts.late, color: 'var(--warning)' },
    { label: 'Absent', value: counts.absent, color: 'var(--danger)' },
    { label: 'Other', value: counts.other, color: 'var(--text-muted)' },
  ]
})
const filteredMonthRecords = computed(() => activeFilter.value === 'all'
  ? monthRecords.value
  : monthRecords.value.filter(record => String(record.status || '').toLowerCase() === activeFilter.value))

function recordKey(record) { return String(record?.id ?? record?.date ?? '') }
function toggleRecord(record) {
  const key = recordKey(record)
  expandedRecordId.value = expandedRecordId.value === key ? null : key
}
function openRecordDetails(record) {
  selectedRecord.value = record
  showRecordModal.value = true
}

function prevMonth() { currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() - 1, 1); expandedRecordId.value = null }
function nextMonth() { currentDate.value = new Date(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 1); expandedRecordId.value = null }
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
.history-filters { display:flex; gap:8px; overflow-x:auto; padding:1px 0 4px; scrollbar-width:none; }
.history-filters::-webkit-scrollbar { display:none; }
.history-filter { flex:0 0 auto; border:1px solid var(--surface-border); border-radius:999px; background:var(--surface); color:var(--text-secondary); padding:7px 13px; font:600 11px var(--font); white-space:nowrap; }
.history-filter.active { color:#fff; background:var(--primary); border-color:var(--primary); }
.records-list { display: flex; flex-direction: column; gap: 6px; max-height: 400px; overflow-y: auto; padding-right: 4px; }
.record-item { padding:10px 12px; border-radius:var(--radius-sm); background:rgba(37,99,235,0.03); border:1px solid var(--surface-border); transition:background var(--transition); }
.record-item:hover { background:rgba(37,99,235,0.06); }
.record-main { display:flex; align-items:center; gap:12px; }
.record-actions { display:none; }
.record-expanded, .record-modal-details { display:grid; gap:0; }
.record-expanded > div, .record-modal-details > div { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--surface-border); font-size:12px; }
.record-expanded > div:last-child, .record-modal-details > div:last-child { border-bottom:0; }
.record-expanded span, .record-modal-details span { color:var(--text-muted); font-weight:600; }
.record-expanded strong, .record-modal-details strong { text-align:right; }
.record-modal-details { gap:0; }
.record-actions .btn { min-height:38px; justify-content:center; white-space:nowrap; }
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
@media (max-width:768px) {
  .history-card { padding:16px; }
  .history-filters { margin:0 -1px; }
  .records-list { max-height:none; overflow:visible; padding:0; }
  .record-item { display:flex; flex-direction:column; gap:10px; padding:12px; border-radius:15px; background:var(--surface); }
  .record-main { width:100%; min-width:0; }
  .record-info { min-width:0; }
  .record-verify { display:none; }
  .record-item.is-expanded .record-verify { display:flex; }
  .record-actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; width:100%; border-top:1px solid var(--surface-border); padding-top:10px; }
  .record-actions .btn { width:100%; }
  .record-expanded { border-top:1px solid var(--surface-border); padding:4px 0; }
}
</style>
