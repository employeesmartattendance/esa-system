<template>
  <div class="page-root">
    <div class="section-header">
      <div>
        <h2 class="section-title">Teachers</h2>
        <p class="section-desc">Manage teacher accounts and credentials</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">
        <AppIcon name="plus" :size="16" />Add Teacher
      </button>
    </div>

    <div class="glass">
      <DataTable :columns="cols" :rows="teachers" :loading="loading" searchable search-placeholder="Search teachers..." empty-icon="teachers" empty-title="No teachers yet" empty-message="Add your first teacher to get started.">
        <template #actions>
          <button class="btn btn-ghost btn-sm" @click="$emit('refresh')"><AppIcon name="refresh" :size="14" />Refresh</button>
        </template>
        <template #cell-name="{ row }">
          <div class="teacher-cell">
            <div class="t-avatar">{{ row.name?.charAt(0) }}</div>
            <div>
              <div class="fw-600">{{ row.name }}</div>
              <div class="text-muted text-xs">{{ row.email }}</div>
            </div>
          </div>
        </template>
        <template #cell-phone="{ row }">
          <span class="text-sm">{{ row.phone || '—' }}</span>
        </template>
        <template #cell-subject="{ row }">
          <span class="text-sm">{{ row.subject || '—' }}</span>
        </template>
        <template #cell-status="{ row }">
          <AppBadge :variant="row.status === 'active' ? 'active' : 'inactive'" :label="row.status || 'active'" dot />
        </template>
        <template #cell-today="{ row }">
          <AppBadge :variant="row.today_status || 'absent'" :label="row.today_status || 'absent'" dot />
        </template>
        <template #cell-actions="{ row }">
          <div class="row-actions">
            <button class="icon-btn" title="View details" @click="openView(row)"><AppIcon name="eye" :size="15" /></button>
            <button class="icon-btn" title="Edit" @click="openEdit(row)"><AppIcon name="edit" :size="15" /></button>
            <button class="icon-btn danger" title="Delete" @click="confirmDelete(row)"><AppIcon name="trash" :size="15" /></button>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- View Details Modal -->
    <AppModal v-model="showViewModal" title="Teacher Details" icon="user" max-width="480px">
      <div v-if="viewTarget" class="view-detail-grid">
        <div class="vd-row"><span class="vd-label">Name</span><span class="vd-val">{{ viewTarget.name }}</span></div>
        <div class="vd-row"><span class="vd-label">Email</span><span class="vd-val">{{ viewTarget.email }}</span></div>
        <div class="vd-row"><span class="vd-label">Phone</span><span class="vd-val">{{ viewTarget.phone || '—' }}</span></div>
        <div class="vd-row"><span class="vd-label">Subject</span><span class="vd-val">{{ viewTarget.subject || '—' }}</span></div>
        <div class="vd-row"><span class="vd-label">Today</span><span class="vd-val"><AppBadge :variant="viewTarget.today_status||'absent'" :label="viewTarget.today_status||'absent'" dot /></span></div>
        <div class="vd-row"><span class="vd-label">Status</span><span class="vd-val"><AppBadge :variant="viewTarget.status==='active'?'active':'inactive'" :label="viewTarget.status||'active'" dot /></span></div>
        <div class="vd-row"><span class="vd-label">Check In</span><span class="vd-val">{{ viewTarget.check_in || '—' }}</span></div>
      </div>
      <div class="form-actions"><button class="btn btn-ghost" @click="showViewModal=false">Close</button><button class="btn btn-primary" @click="showViewModal=false;openEdit(viewTarget)"><AppIcon name="edit" :size="14"/>Edit</button></div>
    </AppModal>

    <!-- Create/Edit Modal -->
    <AppModal v-model="showModal" :title="editing ? 'Edit Teacher' : 'Add Teacher'" icon="user" max-width="580px">
      <form @submit.prevent="save" class="modal-form">
        <div class="form-row two-col">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input v-model="form.name" class="form-input" placeholder="Teacher's full name" required />
          </div>
          <div class="form-group">
            <label class="form-label">Email *</label>
            <input v-model="form.email" type="email" class="form-input" placeholder="teacher@school.com" required />
          </div>
        </div>
        <div class="form-row two-col">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input v-model="form.phone" class="form-input" placeholder="+250 7xx xxx xxx" />
          </div>
          <div class="form-group">
            <label class="form-label">Subject</label>
            <input v-model="form.subject" class="form-input" placeholder="e.g. Mathematics" />
          </div>
        </div>
        <div class="form-group" v-if="!editing">
          <label class="form-label">Password *</label>
          <input v-model="form.password" type="password" class="form-input" placeholder="Minimum 8 characters" required minlength="8" />
        </div>
        <div v-if="editing" class="form-group">
          <label class="form-label">New Password <span class="optional">(leave blank to keep current)</span></label>
          <input v-model="form.password" type="password" class="form-input" placeholder="Leave blank to keep current" />
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" @click="showModal=false">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="btn-spinner-sm"></span>
            {{ editing ? 'Save Changes' : 'Add Teacher' }}
          </button>
        </div>
      </form>
    </AppModal>

    <!-- Delete confirm -->
    <AppModal v-model="showDeleteModal" title="Remove Teacher" subtitle="This cannot be undone" icon="trash" icon-color="var(--danger)">
      <p style="font-size:14px;color:var(--text-secondary);margin-bottom:20px">
        Remove <strong>{{ deleteTarget?.name }}</strong> from this school? Their attendance records will be kept.
      </p>
      <div class="form-actions">
        <button class="btn btn-ghost" @click="showDeleteModal=false">Cancel</button>
        <button class="btn btn-danger" @click="doDelete" :disabled="saving"><AppIcon name="trash" :size="15" />Remove</button>
      </div>
    </AppModal>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import DataTable from '../ui/DataTable.vue'
import AppModal from '../ui/AppModal.vue'
import AppBadge from '../ui/AppBadge.vue'
import AppIcon from '../ui/AppIcon.vue'
import { useToast } from '../../composables/useToast'
import api from '../../api'

const props = defineProps({ teachers: { type: Array, default: () => [] }, loading: Boolean, schoolId: [Number, String] })
const emit = defineEmits(['refresh'])
const toast = useToast()

const showModal = ref(false)
const showDeleteModal = ref(false)
const showViewModal = ref(false)
const viewTarget = ref(null)
const editing = ref(false)
const saving = ref(false)
const deleteTarget = ref(null)
const form = ref({ name: '', email: '', phone: '', subject: '', password: '' })

function openView(row) { viewTarget.value = row; showViewModal.value = true }

const cols = [
  { key: 'name', label: 'Teacher', sortable: true },
  { key: 'subject', label: 'Subject', hideMobile: true },
  { key: 'phone', label: 'Phone', hideMobile: true },
  { key: 'today', label: "Today's Status", hideMobile: true },
  { key: 'status', label: 'Account', hideMobile: true },
  { key: 'actions', label: 'Actions' },
]

function openCreate() { editing.value = false; form.value = { name: '', email: '', phone: '', subject: '', password: '' }; showModal.value = true }
function openEdit(row) { editing.value = true; form.value = { ...row, password: '' }; showModal.value = true }
function confirmDelete(row) { deleteTarget.value = row; showDeleteModal.value = true }

async function save() {
  saving.value = true
  try {
    if (editing.value) await api.put(`/teachers/${form.value.id}`, form.value)
    else await api.post('/teachers', form.value)
    toast.success(editing.value ? 'Teacher updated' : 'Teacher added successfully')
    showModal.value = false; emit('refresh')
  } catch (e) { toast.error(e.response?.data?.message || e.response?.data?.error || 'Failed to save teacher') }
  finally { saving.value = false }
}

async function doDelete() {
  saving.value = true
  try {
    await api.delete(`/teachers/${deleteTarget.value.id}`)
    toast.success('Teacher removed')
    showDeleteModal.value = false; emit('refresh')
  } catch { toast.error('Failed to remove teacher') }
  finally { saving.value = false }
}
</script>

<style scoped>
.page-root { width: 100%; max-width: 100%; overflow-x: hidden; box-sizing: border-box; padding-right: 4px; }
.glass { width: 100%; min-width: 0; overflow: hidden; box-sizing: border-box; margin-right: 12px; }
.section-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; padding-right: 12px; }
.section-title { font-size: 22px; font-weight: 800; }
.section-desc { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
.teacher-cell { display: flex; align-items: center; gap: 10px; min-width: 0; overflow: hidden; }
.t-avatar { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--primary), var(--accent)); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 14px; flex-shrink: 0; }
.fw-600 { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: normal; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.text-muted { color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: normal; word-break: break-word; }
.text-xs { font-size: 11px; }
.text-sm { font-size: 13px; }
.row-actions { display: flex; gap: 6px; }
.icon-btn { width: 30px; height: 30px; border-radius: var(--radius-sm); border: 1px solid var(--surface-border); background: var(--surface); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all var(--transition); flex-shrink: 0; }
.icon-btn:hover { border-color: var(--primary); color: var(--primary); }
.icon-btn.danger:hover { border-color: var(--danger); color: var(--danger); background: rgba(239,68,68,0.06); }
.modal-form { display: flex; flex-direction: column; gap: 16px; }
.form-row { display: flex; flex-direction: column; gap: 16px; }
.two-col { flex-direction: row; }
.optional { font-size: 11px; color: var(--text-muted); font-weight: 400; text-transform: none; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
.btn-spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
/* View detail modal */
.view-detail-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.vd-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-sm); overflow: hidden; }
.vd-label { font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; min-width: 80px; flex-shrink: 0; }
.vd-val { font-size: 13px; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; word-break: break-word; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 768px) { 
  .page-root { padding-right: 0; }
  .section-header { flex-direction: column; align-items: flex-start; padding-right: 0; }
  .section-header .btn { width: 100%; justify-content: center; }
  .glass { margin-right: 0; }
  .two-col { flex-direction: column; }
  .teacher-cell { min-width: 0; }
  .row-actions { flex-wrap: nowrap; }
}
@media (max-width: 480px) {
  .section-title { font-size: 19px; }
}
</style>
