<template>
  <div class="page-root">
    <div class="section-header">
      <div>
        <h2 class="section-title">Shifts</h2>
        <p class="section-desc">Define work shifts and assign {{ vocab.personNounPlural.toLowerCase() }} to them</p>
      </div>
      <button class="btn btn-primary btn-add-person" @click="openCreate">
        <AppIcon name="plus" :size="16" />Add Shift
      </button>
    </div>

    <div class="glass">
      <DataTable :columns="cols" :rows="shifts" :loading="loading" searchable search-placeholder="Search shifts..." empty-icon="clock" empty-title="No shifts yet" :empty-message="`Create a shift (e.g. Morning 08h-17h) then assign ${vocab.personNounPlural.toLowerCase()} to it.`">
        <template #actions>
          <button class="btn btn-ghost btn-sm" @click="fetchShifts"><AppIcon name="refresh" :size="14" />Refresh</button>
        </template>
        <template #cell-name="{ row }">
          <div class="shift-cell">
            <span class="shift-dot" :style="{ background: row.color || '#6366f1' }"></span>
            <div>
              <div class="fw-600">{{ row.name }}</div>
              <div class="text-muted text-xs">{{ formatDays(row.days) }}</div>
            </div>
          </div>
        </template>
        <template #cell-time="{ row }">
          <span class="text-sm mono-font">{{ fmt(row.start_time) }} – {{ fmt(row.end_time) }}</span>
        </template>
        <template #cell-checkout="{ row }">
          <span class="text-sm mono-font">{{ fmt(row.checkout_time) || fmt(row.end_time) }}</span>
        </template>
        <template #cell-employees="{ row }">
          <AppBadge variant="active" :label="`${row.employee_count} assigned`" />
        </template>
        <template #cell-status="{ row }">
          <AppBadge :variant="row.status === 'active' ? 'active' : 'inactive'" :label="row.status" dot />
        </template>
        <template #cell-actions="{ row }">
          <div class="row-actions">
            <button class="icon-btn" title="Assign employees" @click="openAssign(row)"><AppIcon name="user-check" :size="15" /></button>
            <button class="icon-btn" title="Edit" @click="openEdit(row)"><AppIcon name="edit" :size="15" /></button>
            <button class="icon-btn danger" title="Delete" @click="confirmDelete(row)"><AppIcon name="trash" :size="15" /></button>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- Create/Edit Modal -->
    <AppModal v-model="showModal" :title="editing ? 'Edit Shift' : 'Add Shift'" icon="clock" max-width="580px">
      <form @submit.prevent="save" class="modal-form">
        <div class="form-group">
          <label class="form-label">Shift Name *</label>
          <input v-model="form.name" class="form-input" placeholder="e.g. Morning, Evening, Night" required />
        </div>
        <div class="form-row two-col">
          <div class="form-group">
            <label class="form-label">Start Time *</label>
            <input v-model="form.start_time" type="time" class="form-input mono-font" required />
          </div>
          <div class="form-group">
            <label class="form-label">End Time *</label>
            <input v-model="form.end_time" type="time" class="form-input mono-font" required />
          </div>
        </div>
        <p class="field-hint">Employees on this shift can check in from the check-in window below, and are marked <strong>late</strong> or <strong>absent</strong> based on the thresholds below. Leave a field blank to use the shift's start/end time.</p>
        <div class="form-row two-col">
          <div class="form-group">
            <label class="form-label">Check-in Opens</label>
            <input v-model="form.checkin_start" type="time" class="form-input mono-font" placeholder="Defaults to school setting" />
          </div>
          <div class="form-group">
            <label class="form-label">Late After</label>
            <input v-model="form.late_threshold" type="time" class="form-input mono-font" :placeholder="form.start_time || 'Shift start'" />
          </div>
        </div>
        <div class="form-row two-col">
          <div class="form-group">
            <label class="form-label">Absent After</label>
            <input v-model="form.absent_threshold" type="time" class="form-input mono-font" :placeholder="form.end_time || 'Shift end'" />
          </div>
          <div class="form-group">
            <label class="form-label">Auto Checkout Time</label>
            <input v-model="form.checkout_time" type="time" class="form-input mono-font" :placeholder="form.end_time || 'Shift end'" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Active Days</label>
          <div class="days-row">
            <button
              v-for="d in dayOptions" :key="d.value" type="button"
              class="day-chip" :class="{ active: form.days.includes(d.value) }"
              @click="toggleDay(d.value)"
            >{{ d.label }}</button>
          </div>
        </div>
        <div class="form-row two-col">
          <div class="form-group">
            <label class="form-label">Color</label>
            <input v-model="form.color" type="color" class="form-input color-input" />
          </div>
          <div class="form-group toggle-group">
            <label class="form-label">Auto Checkout</label>
            <label class="toggle-switch">
              <input type="checkbox" v-model="form.auto_checkout_enabled" />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" @click="showModal=false">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="btn-spinner-sm"></span>
            {{ editing ? 'Save Changes' : 'Add Shift' }}
          </button>
        </div>
      </form>
    </AppModal>

    <!-- Assign employees modal -->
    <AppModal v-model="showAssignModal" :title="`Assign to ${assignTarget?.name || ''}`" subtitle="Select who works this shift" icon="user-check" max-width="480px">
      <div v-if="assignTarget" class="assign-body">
        <p class="field-hint" style="margin-top:0">{{ vocab.personNounPlural }} not selected keep their current shift (or none).</p>
        <div class="assign-list">
          <label v-for="t in teachers" :key="t.teacher_id" class="assign-row">
            <input type="checkbox" v-model="assignSelection" :value="t.teacher_id" />
            <span class="assign-name">{{ t.name }}</span>
            <span class="assign-current">{{ t.shift_id === assignTarget.id ? 'On this shift' : (t.shift_name || 'No shift') }}</span>
          </label>
          <p v-if="!teachers.length" class="text-muted text-sm" style="padding:12px 0">No {{ vocab.personNounPlural.toLowerCase() }} yet — add some first.</p>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" @click="showAssignModal=false">Cancel</button>
          <button type="button" class="btn btn-primary" :disabled="saving || !assignSelection.length" @click="doAssign">
            <span v-if="saving" class="btn-spinner-sm"></span>
            Assign {{ assignSelection.length || '' }}
          </button>
        </div>
      </div>
    </AppModal>

    <!-- Delete confirm -->
    <AppModal v-model="showDeleteModal" title="Delete Shift" subtitle="This cannot be undone" icon="trash" icon-color="var(--danger)">
      <p style="font-size:14px;color:var(--text-secondary);margin-bottom:20px">
        Delete <strong>{{ deleteTarget?.name }}</strong>?
        <span v-if="deleteTarget?.employee_count"> {{ deleteTarget.employee_count }} {{ deleteTarget.employee_count === 1 ? 'person is' : 'people are' }} still assigned — reassign them first.</span>
      </p>
      <div class="form-actions">
        <button class="btn btn-ghost" @click="showDeleteModal=false">Cancel</button>
        <button class="btn btn-danger" @click="doDelete" :disabled="saving || !!deleteTarget?.employee_count"><AppIcon name="trash" :size="15" />Delete</button>
      </div>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import DataTable from '../ui/DataTable.vue'
import AppModal from '../ui/AppModal.vue'
import AppBadge from '../ui/AppBadge.vue'
import AppIcon from '../ui/AppIcon.vue'
import { useToast } from '../../composables/useToast'
import { useIndustry } from '../../composables/useIndustry'
import { getSocket } from '../../socket'
import api from '../../api'

const props = defineProps({
  teachers: { type: Array, default: () => [] },
})
const emit = defineEmits(['refresh'])
const toast = useToast()
const { vocab } = useIndustry()

const shifts = ref([])
const loading = ref(false)

async function fetchShifts() {
  loading.value = true
  try {
    const r = await api.get('/school/shifts')
    shifts.value = Array.isArray(r) ? r : []
  } catch (e) { console.error('fetchShifts', e) }
  finally { loading.value = false }
}

const cols = [
  { key: 'name', label: 'Shift', sortable: true },
  { key: 'time', label: 'Hours' },
  { key: 'checkout', label: 'Auto Checkout', hideMobile: true },
  { key: 'employees', label: vocab.value.personNounPlural, hideMobile: true },
  { key: 'status', label: 'Status', hideMobile: true },
  { key: 'actions', label: 'Actions' },
]

function fmt(t) { return t ? String(t).substring(0, 5) : '' }
const dayOptions = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }, { value: 0, label: 'Sun' },
]
function formatDays(days) {
  if (!days || days.length === 7) return 'Every day'
  const set = new Set(days)
  if ([1,2,3,4,5].every(d => set.has(d)) && days.length === 5) return 'Mon – Fri'
  return dayOptions.filter(d => set.has(d.value)).map(d => d.label).join(', ')
}

const showModal = ref(false)
const showDeleteModal = ref(false)
const showAssignModal = ref(false)
const editing = ref(false)
const saving = ref(false)
const deleteTarget = ref(null)
const assignTarget = ref(null)
const assignSelection = ref([])
const emptyForm = () => ({ name: '', start_time: '08:00', end_time: '17:00', checkin_start: '', late_threshold: '', absent_threshold: '', checkout_time: '', auto_checkout_enabled: true, days: [1,2,3,4,5], color: '#6366f1' })
const form = ref(emptyForm())

function toggleDay(v) {
  const i = form.value.days.indexOf(v)
  if (i === -1) form.value.days.push(v)
  else if (form.value.days.length > 1) form.value.days.splice(i, 1)
}

function openCreate() { editing.value = false; form.value = emptyForm(); showModal.value = true }
function openEdit(row) {
  editing.value = true
  form.value = {
    id: row.id, name: row.name,
    start_time: fmt(row.start_time) || '08:00', end_time: fmt(row.end_time) || '17:00',
    checkin_start: fmt(row.checkin_start), late_threshold: fmt(row.late_threshold),
    absent_threshold: fmt(row.absent_threshold), checkout_time: fmt(row.checkout_time),
    auto_checkout_enabled: row.auto_checkout_enabled !== false,
    days: row.days && row.days.length ? [...row.days] : [1,2,3,4,5],
    color: row.color || '#6366f1',
  }
  showModal.value = true
}
function confirmDelete(row) { deleteTarget.value = row; showDeleteModal.value = true }
function openAssign(row) {
  assignTarget.value = row
  assignSelection.value = props.teachers.filter(t => t.shift_id === row.id).map(t => t.teacher_id)
  showAssignModal.value = true
}

async function save() {
  saving.value = true
  try {
    if (editing.value) await api.put(`/school/shifts/${form.value.id}`, form.value)
    else await api.post('/school/shifts', form.value)
    toast.success(editing.value ? 'Shift updated' : 'Shift added successfully')
    showModal.value = false
    fetchShifts()
    emit('refresh')
  } catch (e) { toast.error(e.response?.data?.message || 'Failed to save shift') }
  finally { saving.value = false }
}

async function doDelete() {
  saving.value = true
  try {
    await api.delete(`/school/shifts/${deleteTarget.value.id}`)
    toast.success('Shift removed')
    showDeleteModal.value = false
    fetchShifts()
    emit('refresh')
  } catch (e) { toast.error(e.response?.data?.message || 'Failed to remove shift') }
  finally { saving.value = false }
}

async function doAssign() {
  saving.value = true
  try {
    const r = await api.post(`/school/shifts/${assignTarget.value.id}/assign`, { teacherIds: assignSelection.value })
    toast.success(`${r?.count ?? assignSelection.value.length} ${vocab.value.personNoun.toLowerCase()}(s) assigned to ${assignTarget.value.name}`)
    showAssignModal.value = false
    fetchShifts()
    emit('refresh')
  } catch (e) { toast.error(e.response?.data?.message || 'Failed to assign shift') }
  finally { saving.value = false }
}

onMounted(() => {
  fetchShifts()
  const socket = getSocket()
  if (socket) socket.on('shift_updated', fetchShifts)
})
onUnmounted(() => {
  const socket = getSocket()
  if (socket) socket.off('shift_updated', fetchShifts)
})

defineExpose({ fetchShifts })
</script>

<style scoped>
.page-root { width: 100%; max-width: 100%; overflow-x: hidden; box-sizing: border-box; padding-right: 4px; }
.glass { width: 100%; min-width: 0; overflow: hidden; box-sizing: border-box; margin-right: 12px; }
.section-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; padding-right: 12px; }
.btn.btn-primary.btn-add-person:hover:not(:disabled) { transform: scale(1.035); box-shadow: 0 6px 22px var(--primary-glow); }
.btn.btn-primary.btn-add-person:active:not(:disabled) { transform: scale(0.98); }
.section-title { font-size: 22px; font-weight: 800; }
.section-desc { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
.shift-cell { display: flex; align-items: center; gap: 10px; min-width: 0; overflow: hidden; }
.shift-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(0,0,0,0.04); }
.fw-600 { font-weight: 600; }
.text-muted { color: var(--text-muted); }
.text-xs { font-size: 11px; }
.text-sm { font-size: 13px; }
.mono-font { font-variant-numeric: tabular-nums; font-family: 'SF Mono', Menlo, monospace; }
.row-actions { display: flex; gap: 6px; }
.icon-btn { width: 30px; height: 30px; border-radius: var(--radius-sm); border: 1px solid var(--surface-border); background: var(--surface); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all var(--transition); flex-shrink: 0; }
.icon-btn:hover { border-color: var(--primary); color: var(--primary); }
.icon-btn.danger:hover { border-color: var(--danger); color: var(--danger); background: rgba(239,68,68,0.06); }
.modal-form { display: flex; flex-direction: column; gap: 16px; }
.form-row { display: flex; flex-direction: column; gap: 16px; }
.two-col { flex-direction: row; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
.btn-spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
.field-hint { font-size: 12px; color: var(--text-muted); line-height: 1.5; margin: -4px 0 0; }
.days-row { display: flex; gap: 6px; flex-wrap: wrap; }
.day-chip { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--surface-border); background: var(--surface); color: var(--text-secondary); font-size: 12px; font-weight: 600; cursor: pointer; transition: all var(--transition); }
.day-chip.active { background: var(--primary); border-color: var(--primary); color: #fff; }
.color-input { padding: 4px; height: 40px; cursor: pointer; }
.toggle-group { display: flex; flex-direction: column; justify-content: center; }
.toggle-switch { position: relative; display: inline-block; width: 42px; height: 24px; }
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-slider { position: absolute; cursor: pointer; inset: 0; background: var(--surface-border); border-radius: 999px; transition: all var(--transition); }
.toggle-slider::before { content: ''; position: absolute; width: 18px; height: 18px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: all var(--transition); }
.toggle-switch input:checked + .toggle-slider { background: var(--primary); }
.toggle-switch input:checked + .toggle-slider::before { transform: translateX(18px); }
.assign-body { display: flex; flex-direction: column; gap: 12px; }
.assign-list { display: flex; flex-direction: column; gap: 4px; max-height: 320px; overflow-y: auto; }
.assign-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--surface-border); background: var(--surface); cursor: pointer; }
.assign-row input { flex-shrink: 0; }
.assign-name { font-weight: 600; font-size: 13px; flex: 1; }
.assign-current { font-size: 11px; color: var(--text-muted); }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 768px) {
  .page-root { padding-right: 0; }
  .section-header { flex-direction: column; align-items: flex-start; padding-right: 0; }
  .section-header .btn { width: 100%; justify-content: center; }
  .glass { margin-right: 0; }
  .two-col { flex-direction: column; }
}
@media (max-width: 480px) {
  .section-title { font-size: 19px; }
}
</style>
