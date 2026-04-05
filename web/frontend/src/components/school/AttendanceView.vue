<template>
  <div>
    <div class="section-header">
      <div>
        <h2 class="section-title">Attendance Records</h2>
        <p class="section-desc">Real-time and historical attendance data</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost btn-sm" @click="$emit('refresh')"><AppIcon name="refresh" :size="14" />Refresh</button>
        <button class="btn btn-accent btn-sm" @click="exportPDF"><AppIcon name="export" :size="14" />Export PDF</button>
      </div>
    </div>

    <!-- Today status cards -->
    <div class="status-row">
      <div class="status-card glass" v-for="s in todayStats" :key="s.label">
        <div class="status-icon" :style="`background:${s.bg};color:${s.color}`">
          <AppIcon :name="s.icon" :size="20" />
        </div>
        <div class="status-info">
          <div class="status-val" :style="`color:${s.color}`">{{ s.val }}</div>
          <div class="status-label">{{ s.label }}</div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="glass filters-bar">
      <div class="filter-group">
        <label class="filter-label"><AppIcon name="clock" :size="13" />Date</label>
        <input v-model="filters.date" type="date" class="form-input filter-input" />
      </div>
      <div class="filter-group">
        <label class="filter-label"><AppIcon name="user" :size="13" />Teacher</label>
        <select v-model="filters.teacherId" class="form-input form-select filter-input">
          <option value="">All Teachers</option>
          <option v-for="t in teachers" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label"><AppIcon name="filter" :size="13" />Status</label>
        <select v-model="filters.status" class="form-input form-select filter-input">
          <option value="">All Status</option>
          <option value="present">Present</option>
          <option value="late">Late</option>
          <option value="absent">Absent</option>
        </select>
      </div>
      <div class="filter-actions">
        <button class="btn btn-primary btn-sm" @click="applyFilters">
          <AppIcon name="search" :size="14" />Apply
        </button>
        <button class="btn btn-ghost btn-sm" @click="clearFilters">Clear</button>
      </div>
    </div>

    <!-- Live badges -->
    <div class="live-bar glass">
      <div class="live-pill"><span class="live-dot-anim"></span>LIVE</div>
      <span class="live-text">Showing real-time updates · Last updated {{ lastUpdate }}</span>
    </div>

    <!-- Table -->
    <div class="glass">
      <DataTable :columns="cols" :rows="filteredRecords" :loading="loading" empty-icon="attendance" empty-title="No records found" empty-message="Attendance records will appear here.">
        <template #cell-teacher="{ row }">
          <div class="teacher-cell">
            <div class="t-avatar-sm">{{ row.teacher_name?.charAt(0) }}</div>
            <span class="fw-500">{{ row.teacher_name }}</span>
          </div>
        </template>
        <template #cell-date="{ row }">
          <span class="text-sm">{{ formatDate(row.date) }}</span>
        </template>
        <template #cell-checkin="{ row }">
          <span class="time-val">{{ row.check_in || '—' }}</span>
        </template>
        <template #cell-checkout="{ row }">
          <span class="time-val">{{ row.check_out || '—' }}</span>
        </template>
        <template #cell-status="{ row }">
          <AppBadge :variant="row.status" :label="row.status" dot />
        </template>
        <template #cell-verify="{ row }">
          <div class="verify-badges">
            <span class="verify-chip" :class="row.gps_valid ? 'ok' : 'fail'">
              <AppIcon name="location" :size="11" />GPS
            </span>
            <span class="verify-chip" :class="row.wifi_valid ? 'ok' : 'fail'">
              <AppIcon name="wifi" :size="11" />WiFi
            </span>
          </div>
        </template>
        <template #cell-actions="{ row }">
          <button class="icon-btn" title="View details" @click="openView(row)">
            <AppIcon name="eye" :size="15" />
          </button>
        </template>
      </DataTable>
    </div>

    <!-- View Attendance Modal -->
    <AppModal v-model="showViewModal" title="Attendance Details" icon="attendance" max-width="460px">
      <div v-if="viewTarget" class="view-detail-grid">
        <div class="vd-row"><span class="vd-label">Teacher</span><span class="vd-val">{{ viewTarget.teacher_name }}</span></div>
        <div class="vd-row"><span class="vd-label">Date</span><span class="vd-val">{{ formatDate(viewTarget.date) }}</span></div>
        <div class="vd-row"><span class="vd-label">Check In</span><span class="vd-val">{{ viewTarget.check_in || '—' }}</span></div>
        <div class="vd-row"><span class="vd-label">Check Out</span><span class="vd-val">{{ viewTarget.check_out || '—' }}</span></div>
        <div class="vd-row"><span class="vd-label">Status</span><span class="vd-val"><AppBadge :variant="viewTarget.status" :label="viewTarget.status" dot /></span></div>
        <div class="vd-row"><span class="vd-label">GPS</span><span class="vd-val" :style="viewTarget.gps_valid?'color:var(--success)':'color:var(--danger)'">{{ viewTarget.gps_valid ? '✓ Valid' : '✗ Invalid' }}</span></div>
        <div class="vd-row"><span class="vd-label">WiFi</span><span class="vd-val" :style="viewTarget.wifi_valid?'color:var(--success)':'color:var(--danger)'">{{ viewTarget.wifi_valid ? '✓ Valid' : '✗ Invalid' }}</span></div>
      </div>
      <div class="form-actions"><button class="btn btn-ghost" @click="showViewModal=false">Close</button></div>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import DataTable from '../ui/DataTable.vue'
import AppBadge from '../ui/AppBadge.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppModal from '../ui/AppModal.vue'
import { useToast } from '../../composables/useToast'
import api from '../../api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const props = defineProps({ records: { type: Array, default: () => [] }, teachers: { type: Array, default: () => [] }, loading: Boolean })
const emit = defineEmits(['refresh'])
const showViewModal = ref(false)
const viewTarget = ref(null)
function openView(row) { viewTarget.value = row; showViewModal.value = true }
const toast = useToast()

const filters = ref({ date: new Date().toISOString().split('T')[0], teacherId: '', status: '' })
const appliedFilters = ref({ ...filters.value })
const lastUpdate = ref(new Date().toLocaleTimeString())

const cols = [
  { key: 'teacher', label: 'Teacher', sortable: true },
  { key: 'date', label: 'Date', sortable: true, hideMobile: true },
  { key: 'checkin', label: 'Check In', hideMobile: true },
  { key: 'checkout', label: 'Check Out', hideMobile: true },
  { key: 'status', label: 'Status', hideMobile: true },
  { key: 'verify', label: 'Verified', hideMobile: true },
  { key: 'actions', label: 'Actions' },
]

const filteredRecords = computed(() => {
  let r = props.records
  if (appliedFilters.value.teacherId) r = r.filter(x => x.teacher_id == appliedFilters.value.teacherId)
  if (appliedFilters.value.status) r = r.filter(x => x.status === appliedFilters.value.status)
  return r
})

const todayStats = computed(() => {
  const today = props.records.filter(r => r.date === new Date().toISOString().split('T')[0])
  const present = today.filter(r => r.status === 'present').length
  const late = today.filter(r => r.status === 'late').length
  const absent = today.filter(r => r.status === 'absent').length
  return [
    { icon: 'check-circle', label: 'Present', val: present, bg: 'rgba(16,185,129,0.12)', color: 'var(--success)' },
    { icon: 'clock', label: 'Late', val: late, bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)' },
    { icon: 'x-circle', label: 'Absent', val: absent, bg: 'rgba(239,68,68,0.12)', color: 'var(--danger)' },
    { icon: 'teachers', label: 'Total', val: props.teachers.length, bg: 'rgba(37,99,235,0.12)', color: 'var(--primary)' },
  ]
})

function applyFilters() { appliedFilters.value = { ...filters.value }; lastUpdate.value = new Date().toLocaleTimeString(); emit('refresh') }
function clearFilters() { filters.value = { date: '', teacherId: '', status: '' }; appliedFilters.value = { ...filters.value }; emit('refresh') }
watch(() => props.records, () => { lastUpdate.value = new Date().toLocaleTimeString() }, { deep: true })

function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }

function exportPDF() {
  const rows = filteredRecords.value.map(r => ({ ...r }))
  if (!rows.length) { toast.warning('No records to export'); return }
  const exportFilters = { ...appliedFilters.value }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const now   = new Date()
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  // ── Header banner ────────────────────────────────────────────
  const drawHeader = (data) => {
    doc.setFillColor(37, 99, 235)    // primary blue
    doc.rect(0, 0, pageW, 22, 'F')
    // Logo text
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(255, 255, 255)
    doc.text('ESA', 14, 14)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Employee Smart Attendance System', 32, 14)
    // Right: date/time
    doc.setFontSize(8)
    doc.text(`Generated: ${dateStr}  ${timeStr}`, pageW - 14, 10, { align: 'right' })
    doc.text(`Page ${data.pageNumber}`, pageW - 14, 16, { align: 'right' })
    // Subtitle bar
    doc.setFillColor(239, 246, 255)  // light blue
    doc.rect(0, 22, pageW, 12, 'F')
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text('Attendance Records Report', 14, 30)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(`Filters: ${exportFilters.date || 'All dates'} · ${exportFilters.status || 'All statuses'}`, pageW - 14, 30, { align: 'right' })
  }

  // ── Status color mapping ──────────────────────────────────────
  const statusColor = (s) => {
    if (s === 'present') return [16, 185, 129]
    if (s === 'late')    return [245, 158, 11]
    if (s === 'absent')  return [239, 68, 68]
    return [100, 116, 139]
  }

  // ── Table ─────────────────────────────────────────────────────
  const usableWidth = pageW - 28
  const columnWeights = [0.06, 0.24, 0.12, 0.12, 0.12, 0.10, 0.12, 0.12]
  const colWidth = (i) => Math.floor(usableWidth * columnWeights[i] * 100) / 100

  autoTable(doc, {
    startY: 40,
    margin: { top: 40, left: 14, right: 14, bottom: 20 },
    tableWidth: usableWidth,
    head: [['#', 'Teacher', 'Date', 'Check In', 'Check Out', 'Status', 'GPS', 'WiFi']],
    body: rows.map((r, i) => [
      i + 1,
      r.teacher_name || '—',
      formatDate(r.date),
      r.check_in  || '—',
      r.check_out || '—',
      (r.status || '').toUpperCase(),
      r.gps_valid  ? '✓ Valid' : '✗ Invalid',
      r.wifi_valid ? '✓ Valid' : '✗ Invalid',
    ]),
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      overflow: 'hidden',
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
    },
    alternateRowStyles: { fillColor: [239, 246, 255] },
    bodyStyles: { fontSize: 9, cellPadding: { top: 4, bottom: 4, left: 4, right: 4 }, textColor: [30, 41, 59] },
    styles: { overflow: 'ellipsize' },
    columnStyles: {
      0: { halign: 'center', cellWidth: colWidth(0) },
      1: { cellWidth: colWidth(1), fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: colWidth(2) },
      3: { halign: 'center', cellWidth: colWidth(3), fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: colWidth(4), fontStyle: 'bold' },
      5: { halign: 'center', cellWidth: colWidth(5) },
      6: { halign: 'center', cellWidth: colWidth(6) },
      7: { halign: 'center', cellWidth: colWidth(7) },
    },
    didParseCell: (data) => {
      if (data.section === 'head') {
        data.cell.styles.overflow = 'hidden'
      }
      if (data.column.index === 5 && data.section === 'body') {
        const [r, g, b] = statusColor(rows[data.row.index]?.status)
        data.cell.styles.textColor = [r, g, b]
        data.cell.styles.fontStyle = 'bold'
      }
      if (data.column.index >= 6 && data.section === 'body') {
        const val = data.cell.raw
        data.cell.styles.textColor = val?.toString().includes('✓') ? [16,185,129] : [239,68,68]
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: drawHeader,
    showHead: 'everyPage',
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
  })

  // ── Footer on last page ───────────────────────────────────────
  const finalY = doc.lastAutoTable.finalY + 8
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.4)
  doc.line(14, finalY, pageW - 14, finalY)
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(`Total records: ${rows.length}`, 14, finalY + 5)
  doc.text('ESA © ' + now.getFullYear() + ' · Employee Smart Attendance System', pageW / 2, finalY + 5, { align: 'center' })

  const filename = `attendance_${now.toISOString().split('T')[0]}.pdf`
  doc.save(filename)
  toast.success('PDF exported successfully')
}
</script>

<style scoped>
.section-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; }
.section-title { font-size: 22px; font-weight: 800; }
.section-desc { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
.header-actions { display: flex; gap: 8px; }
.status-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.status-card { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-radius: var(--radius); }
.status-icon { width: 44px; height: 44px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.status-val { font-size: 24px; font-weight: 800; line-height: 1; }
.status-label { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.filters-bar { display: flex; align-items: flex-end; gap: 12px; padding: 16px 20px; margin-bottom: 12px; flex-wrap: wrap; }
.filter-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
.filter-group { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 140px; }
.filter-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); display: flex; align-items: center; gap: 4px; }
.filter-input { width: 100%; padding: 8px 12px; font-size: 13px; }
.live-bar { display: flex; align-items: center; gap: 10px; padding: 10px 16px; margin-bottom: 12px; border-radius: var(--radius-sm); }
.live-pill { display: flex; align-items: center; gap: 5px; padding: 3px 9px; background: rgba(16,185,129,0.1); border-radius: 99px; font-size: 11px; font-weight: 700; color: var(--success); letter-spacing: 0.05em; }
.live-dot-anim { width: 6px; height: 6px; border-radius: 50%; background: var(--success); animation: pulse 1.5s ease-in-out infinite; }
.live-text { font-size: 13px; color: var(--text-muted); }
.teacher-cell { display: flex; align-items: center; gap: 8px; min-width: 0; }
.t-avatar-sm { width: 28px; height: 28px; border-radius: 7px; background: linear-gradient(135deg, var(--primary), var(--accent)); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; font-weight: 700; flex-shrink: 0; }
.fw-500 { font-weight: 500; font-size: 13px; }
.text-sm { font-size: 13px; color: var(--text-secondary); }
.time-val { font-size: 13px; font-weight: 600; font-family: var(--mono); }
.verify-badges { display: flex; gap: 4px; }
.verify-chip { display: flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 99px; font-size: 11px; font-weight: 600; }
.verify-chip.ok   { background: rgba(16,185,129,0.12); color: var(--success); }
.verify-chip.fail { background: rgba(239,68,68,0.12); color: var(--danger); }
.icon-btn { width: 30px; height: 30px; border-radius: var(--radius-sm); border: 1px solid var(--surface-border); background: var(--surface); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all var(--transition); }
.icon-btn:hover { border-color: var(--primary); color: var(--primary); }
.view-detail-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.vd-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-sm); }
.vd-label { font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; min-width: 80px; }
.vd-val { font-size: 13px; font-weight: 600; flex: 1; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
@media (max-width: 768px) {
  .status-row { grid-template-columns: repeat(2,1fr); }
  .section-header { flex-direction: column; align-items: flex-start; }
  .header-actions { width: 100%; }
  .header-actions .btn { flex: 1; justify-content: center; }
  .filters-bar { flex-direction: column; padding: 14px 14px; gap: 10px; }
  .filter-group { min-width: 100%; }
  .filter-actions { width: 100%; }
  .filter-actions .btn { flex: 1; justify-content: center; }
  .filter-input { font-size: 14px; }
}
@media (max-width: 480px) {
  .status-row { grid-template-columns: 1fr 1fr; gap: 8px; }
  .status-card { padding: 12px 14px; }
  .status-val { font-size: 20px; }
  .teacher-cell { min-width: 0; }
}
</style>
