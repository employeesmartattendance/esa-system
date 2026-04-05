<template>
  <div class="page-root">
    <div class="section-header">
      <div>
        <h2 class="section-title">Schools Management</h2>
        <p class="section-desc">Create and manage all schools on the platform</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">
        <AppIcon name="plus" :size="16" />New School
      </button>
    </div>

    <!-- Stats row -->
    <div class="schools-stats">
      <div class="mini-stat glass" v-for="s in miniStats" :key="s.label">
        <AppIcon :name="s.icon" :size="18" :color="s.color" />
        <div><div class="mini-val" :style="`color:${s.color}`">{{ s.val }}</div><div class="mini-label">{{ s.label }}</div></div>
      </div>
    </div>

    <div class="glass">
      <DataTable
        :columns="cols"
        :rows="schools"
        :loading="loading"
        searchable
        search-placeholder="Search schools..."
        empty-icon="school"
        empty-title="No schools yet"
        empty-message="Create your first school to get started."
      >
        <template #actions>
          <button class="btn btn-ghost btn-sm" @click="$emit('refresh')">
            <AppIcon name="refresh" :size="14" />Refresh
          </button>
        </template>
        <template #cell-name="{ row }">
          <div class="school-name-cell">
            <div class="school-avatar">{{ row.name?.charAt(0) }}</div>
            <div>
              <div class="fw-600">{{ row.name }}</div>
              <div class="text-muted text-xs">ID #{{ row.id }}</div>
            </div>
          </div>
        </template>
        <template #cell-admin="{ row }">
          <div class="fw-500">{{ row.admin_name || '—' }}</div>
          <div class="text-muted text-xs">{{ row.admin_email }}</div>
        </template>
        <template #cell-teachers="{ row }">
          <AppBadge variant="info" :label="String(row.teacher_count ?? 0)" />
        </template>
        <template #cell-status="{ row }">
          <AppBadge :variant="row.status === 'active' ? 'active' : 'inactive'" :label="row.status" dot />
        </template>
        <template #cell-present="{ row }">
          <span class="present-count">{{ row.present_today ?? 0 }}</span>
          <span class="text-muted"> / {{ row.teacher_count ?? 0 }}</span>
        </template>
        <template #cell-created="{ row }">
          <span class="text-muted text-sm">{{ formatDate(row.created_at) }}</span>
        </template>
        <template #cell-actions="{ row }">
          <div class="row-actions">
            <button class="icon-btn" title="View details" @click="openView(row)"><AppIcon name="eye" :size="15" /></button>
            <button class="icon-btn" title="Edit" @click="openEdit(row)"><AppIcon name="edit" :size="15" /></button>
            <button class="icon-btn" :class="row.status==='active'?'danger':'success'" @click="toggleStatus(row)">
              <AppIcon :name="row.status==='active'?'x-circle':'check-circle'" :size="15" />
            </button>
            <button class="icon-btn danger" title="Delete" @click="confirmDelete(row)"><AppIcon name="trash" :size="15" /></button>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- View School Modal -->
    <AppModal v-model="showViewModal" title="School Details" icon="school" max-width="460px">
      <div v-if="viewTarget" class="view-detail-grid">
        <div class="vd-row"><span class="vd-label">School</span><span class="vd-val">{{ viewTarget.name }}</span></div>
        <div class="vd-row"><span class="vd-label">Admin</span><span class="vd-val">{{ viewTarget.admin_name || '—' }}</span></div>
        <div class="vd-row"><span class="vd-label">Email</span><span class="vd-val">{{ viewTarget.admin_email || '—' }}</span></div>
        <div class="vd-row"><span class="vd-label">Teachers</span><span class="vd-val">{{ viewTarget.teacher_count ?? 0 }}</span></div>
        <div class="vd-row"><span class="vd-label">Today</span><span class="vd-val">{{ viewTarget.present_today ?? 0 }} present</span></div>
        <div class="vd-row"><span class="vd-label">Status</span><span class="vd-val"><AppBadge :variant="viewTarget.status==='active'?'active':'inactive'" :label="viewTarget.status" dot /></span></div>
        <div class="vd-row"><span class="vd-label">Created</span><span class="vd-val">{{ formatDate(viewTarget.created_at) }}</span></div>
      </div>
      <div class="form-actions"><button class="btn btn-ghost" @click="showViewModal=false">Close</button><button class="btn btn-primary" @click="showViewModal=false;openEdit(viewTarget)"><AppIcon name="edit" :size="14"/>Edit</button></div>
    </AppModal>

    <!-- Create/Edit Modal -->
    <AppModal v-model="showModal" :title="editing ? 'Edit School' : 'Create New School'" :subtitle="editing ? 'Update school details' : 'Set up a new school and admin account'" icon="school" max-width="560px">
      <form @submit.prevent="saveSchool" class="modal-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">School Name *</label>
            <input v-model="form.name" class="form-input" placeholder="e.g. Greenfield High School" required />
          </div>
        </div>
        <div class="form-divider"><span>Admin Account</span></div>
        <div class="form-row two-col">
          <div class="form-group">
            <label class="form-label">Admin Name *</label>
            <input v-model="form.admin_name" class="form-input" placeholder="Full name" required />
          </div>
          <div class="form-group">
            <label class="form-label">Admin Email *</label>
            <input v-model="form.admin_email" type="email" class="form-input" placeholder="admin@school.com" required />
          </div>
        </div>
        <div class="form-group" v-if="!editing">
          <label class="form-label">Admin Password *</label>
          <input v-model="form.admin_password" type="password" class="form-input" placeholder="Min 8 characters" required minlength="8" />
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" @click="showModal=false">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="btn-spinner-sm"></span>
            {{ editing ? 'Save Changes' : 'Create School' }}
          </button>
        </div>
      </form>
    </AppModal>

    <!-- Delete confirm -->
    <AppModal v-model="showDeleteModal" title="Delete School" subtitle="This action cannot be undone" icon="trash" icon-color="var(--danger)">
      <p style="color:var(--text-secondary);font-size:14px;margin-bottom:20px">
        Are you sure you want to delete <strong>{{ deleteTarget?.name }}</strong>? All teachers and attendance records will be permanently removed.
      </p>
      <div class="form-actions">
        <button class="btn btn-ghost" @click="showDeleteModal=false">Cancel</button>
        <button class="btn btn-danger" @click="doDelete" :disabled="saving">
          <AppIcon name="trash" :size="15" />Delete Permanently
        </button>
      </div>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import DataTable from '../ui/DataTable.vue'
import AppModal from '../ui/AppModal.vue'
import AppBadge from '../ui/AppBadge.vue'
import AppIcon from '../ui/AppIcon.vue'
import { useToast } from '../../composables/useToast'
import api from '../../api'

const props = defineProps({ schools: { type: Array, default: () => [] }, loading: Boolean })
const emit = defineEmits(['refresh'])
const toast = useToast()

const showModal = ref(false)
const showDeleteModal = ref(false)
const showViewModal = ref(false)
const viewTarget = ref(null)
const editing = ref(false)
const saving = ref(false)
const deleteTarget = ref(null)
const form = ref({ name: '', admin_name: '', admin_email: '', admin_password: '' })

function openView(row) { viewTarget.value = row; showViewModal.value = true }

const cols = [
  { key: 'name', label: 'School', sortable: true },
  { key: 'admin', label: 'Admin', hideMobile: true },
  { key: 'teachers', label: 'Teachers', hideMobile: true },
  { key: 'present', label: 'Today', hideMobile: true },
  { key: 'status', label: 'Status', hideMobile: true },
  { key: 'created', label: 'Created', hideMobile: true },
  { key: 'actions', label: 'Actions' },
]

const miniStats = computed(() => [
  { icon: 'school', label: 'Total Schools', val: props.schools.length, color: 'var(--primary)' },
  { icon: 'check-circle', label: 'Active', val: props.schools.filter(s => s.status === 'active').length, color: 'var(--success)' },
  { icon: 'x-circle', label: 'Inactive', val: props.schools.filter(s => s.status !== 'active').length, color: 'var(--danger)' },
  { icon: 'teachers', label: 'Total Teachers', val: props.schools.reduce((a, s) => a + (s.teacher_count || 0), 0), color: 'var(--accent)' },
])

function openCreate() { editing.value = false; form.value = { name: '', admin_name: '', admin_email: '', admin_password: '' }; showModal.value = true }
function openEdit(row) { editing.value = true; form.value = { ...row, admin_password: '' }; showModal.value = true }
function confirmDelete(row) { deleteTarget.value = row; showDeleteModal.value = true }

async function saveSchool() {
  saving.value = true
  try {
    if (editing.value) await api.put(`/schools/${form.value.id}`, form.value)
    else await api.post('/schools', form.value)
    toast.success(editing.value ? 'School updated successfully' : 'School created successfully')
    showModal.value = false; emit('refresh')
  } catch (e) { toast.error(e.response?.data?.message || e.response?.data?.error || 'Failed to save school') }
  finally { saving.value = false }
}

async function toggleStatus(row) {
  const newStatus = row.status === 'active' ? 'inactive' : 'active'
  try {
    await api.patch(`/schools/${row.id}/status`, { status: newStatus })
    toast.success(`School ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
    emit('refresh')
  } catch { toast.error('Failed to update status') }
}

async function doDelete() {
  saving.value = true
  try {
    await api.delete(`/schools/${deleteTarget.value.id}`)
    toast.success('School deleted')
    showDeleteModal.value = false; emit('refresh')
  } catch { toast.error('Failed to delete school') }
  finally { saving.value = false }
}

function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }
</script>

<style scoped>
.page-root { width: 100%; max-width: 100%; overflow-x: hidden; box-sizing: border-box; padding-right: 4px; }
.section-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 12px; flex-wrap: wrap; padding-right: 12px; }
.section-title { font-size: 22px; font-weight: 800; }
.section-desc { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
.schools-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; width: 100%; box-sizing: border-box; padding-right: 12px; }
.mini-stat { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: var(--radius); min-width: 0; overflow: hidden; }
.mini-val { font-size: 20px; font-weight: 800; line-height: 1; }
.mini-label { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.school-name-cell { display: flex; align-items: center; gap: 10px; min-width: 0; overflow: hidden; }
.school-avatar { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--primary), var(--accent)); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 15px; flex-shrink: 0; }
.fw-600 { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: normal; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.fw-500 { font-weight: 500; font-size: 13px; }
.text-muted { color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: normal; word-break: break-word; }
.text-xs { font-size: 11px; }
.text-sm { font-size: 13px; }
.present-count { font-weight: 700; color: var(--success); }
.row-actions { display: flex; gap: 6px; }
.icon-btn { width: 30px; height: 30px; border-radius: var(--radius-sm); border: 1px solid var(--surface-border); background: var(--surface); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all var(--transition); flex-shrink: 0; }
.icon-btn:hover { border-color: var(--primary); color: var(--primary); }
.icon-btn.danger:hover { border-color: var(--danger); color: var(--danger); background: rgba(239,68,68,0.06); }
.icon-btn.success:hover { border-color: var(--success); color: var(--success); background: rgba(16,185,129,0.06); }
.modal-form { display: flex; flex-direction: column; gap: 16px; }
.form-row { display: flex; flex-direction: column; gap: 16px; }
.two-col { flex-direction: row; }
.form-divider { display: flex; align-items: center; gap: 12px; color: var(--text-muted); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin: 4px 0; }
.form-divider::before, .form-divider::after { content: ''; flex: 1; height: 1px; background: var(--surface-border); }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
.btn-spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
.view-detail-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.vd-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-sm); overflow: hidden; }
.vd-label { font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; min-width: 80px; flex-shrink: 0; }
.vd-val { font-size: 13px; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; word-break: break-word; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 1024px) {
  .schools-stats { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) { 
  .page-root { padding-right: 0; }
  .section-header { flex-direction: column; align-items: flex-start; padding-right: 0; }
  .section-header .btn { width: 100%; justify-content: center; }
  .schools-stats { grid-template-columns: repeat(2, 1fr); gap: 8px; padding-right: 0; }
  .two-col { flex-direction: column; }
  .school-name-cell { min-width: 0; }
  .row-actions { flex-wrap: nowrap; }
}
@media (max-width: 480px) {
  .schools-stats { grid-template-columns: 1fr 1fr; gap: 8px; }
  .mini-stat { padding: 12px 12px; }
  .mini-val { font-size: 18px; }
}
</style>
