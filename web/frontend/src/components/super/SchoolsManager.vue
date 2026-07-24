<template>
  <div class="page-root">
    <div class="section-header">
      <div>
        <h2 class="section-title">Companies Management</h2>
        <p class="section-desc">Create and manage all companies on the platform</p>
      </div>
      <button class="btn btn-primary btn-new-school" @click="openCreate">
        <AppIcon name="plus" :size="16" />New Company
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
        search-placeholder="Search companies..."
        empty-icon="building"
        empty-title="No companies yet"
        empty-message="Create your first company to get started."
      >
        <template #actions>
          <button class="btn btn-ghost btn-sm" @click="$emit('refresh')">
            <AppIcon name="refresh" :size="14" />Refresh
          </button>
        </template>
        <template #cell-name="{ row, index }">
          <div class="school-name-cell">
            <div class="school-avatar">{{ row.name?.charAt(0) }}</div>
            <div>
              <div class="fw-600">{{ row.name }}</div>
              <div class="text-muted text-xs">{{ getIndustry(row.industry).label }}</div>
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
    <AppModal v-model="showViewModal" title="Company Details" icon="building" max-width="460px">
      <div v-if="viewTarget" class="view-detail-grid">
        <div class="vd-row"><span class="vd-label">Company</span><span class="vd-val">{{ viewTarget.name }}</span></div>
        <div class="vd-row"><span class="vd-label">Industry</span><span class="vd-val">{{ getIndustry(viewTarget.industry).label }}</span></div>
        <div class="vd-row"><span class="vd-label">Admin</span><span class="vd-val">{{ viewTarget.admin_name || '—' }}</span></div>
        <div class="vd-row"><span class="vd-label">Email</span><span class="vd-val">{{ viewTarget.admin_email || '—' }}</span></div>
        <div class="vd-row"><span class="vd-label">{{ getIndustry(viewTarget.industry).personNounPlural }}</span><span class="vd-val">{{ viewTarget.teacher_count ?? 0 }}</span></div>
        <div class="vd-row"><span class="vd-label">Today</span><span class="vd-val">{{ viewTarget.present_today ?? 0 }} present</span></div>
        <div class="vd-row"><span class="vd-label">Status</span><span class="vd-val"><AppBadge :variant="viewTarget.status==='active'?'active':'inactive'" :label="viewTarget.status" dot /></span></div>
        <div class="vd-row"><span class="vd-label">Created</span><span class="vd-val">{{ formatDate(viewTarget.created_at) }}</span></div>
      </div>
      <div class="form-actions"><button class="btn btn-ghost" @click="showViewModal=false">Close</button><button class="btn btn-primary" @click="showViewModal=false;openEdit(viewTarget)"><AppIcon name="edit" :size="14"/>Edit</button></div>
    </AppModal>

    <!-- Create/Edit Modal -->
    <AppModal
      v-model="showModal"
      :title="editing ? 'Edit Company' : (createStep === 'industry' ? 'Choose Industry' : 'Create New Company')"
      :subtitle="editing ? 'Update company details' : (createStep === 'industry' ? 'Select the industry this company operates in' : 'Set up a new company and admin account')"
      :icon="editing ? 'building' : (createStep === 'industry' ? 'layers' : 'building')"
      max-width="560px"
    >
      <!-- Step 0: Choose Industry (create flow only) -->
      <div v-if="!editing && createStep === 'industry'" class="industry-grid">
        <button
          v-for="ind in industryList"
          :key="ind.key"
          type="button"
          class="industry-option"
          :class="{ selected: form.industry === ind.key }"
          @click="selectIndustry(ind.key)"
        >
          <div class="industry-icon-wrap"><AppIcon :name="ind.icon" :size="22" /></div>
          <div class="industry-option-label">{{ ind.label }}</div>
          <div class="industry-option-sub">Tracks {{ ind.personNounPlural.toLowerCase() }}</div>
        </button>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost" @click="showModal=false">Cancel</button>
          <button type="button" class="btn btn-primary" :disabled="!form.industry" @click="createStep = 'details'">
            Continue
          </button>
        </div>
      </div>

      <!-- Step 1: Company details (or the only step when editing) -->
      <form v-else @submit.prevent="saveSchool" class="modal-form">
        <div v-if="!editing" class="selected-industry-chip">
          <AppIcon :name="getIndustry(form.industry).icon" :size="14" />
          {{ getIndustry(form.industry).label }}
          <button type="button" class="chip-change-btn" @click="createStep = 'industry'">Change</button>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">{{ getIndustry(form.industry).orgNoun }} Name *</label>
            <input v-model="form.name" class="form-input" :placeholder="`e.g. ${namePlaceholder}`" required />
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
            <input v-model="form.admin_email" type="email" class="form-input" placeholder="admin@company.com" required />
          </div>
        </div>
        <div class="form-group" v-if="!editing">
          <label class="form-label">Admin Password *</label>
          <input v-model="form.admin_password" type="password" class="form-input" placeholder="Min 8 characters" required minlength="8" />
        </div>
        <div class="form-actions">
          <button v-if="!editing" type="button" class="btn btn-ghost" @click="createStep = 'industry'">Back</button>
          <button v-else type="button" class="btn btn-ghost" @click="showModal=false">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <span v-if="saving" class="btn-spinner-sm"></span>
            {{ editing ? 'Save Changes' : 'Create Company' }}
          </button>
        </div>
      </form>
    </AppModal>

    <!-- Delete confirm -->
    <AppModal v-model="showDeleteModal" title="Delete Company" subtitle="This action cannot be undone" icon="trash" icon-color="var(--danger)">
      <p style="color:var(--text-secondary);font-size:14px;margin-bottom:20px">
        Are you sure you want to delete <strong>{{ deleteTarget?.name }}</strong>? All {{ getIndustry(deleteTarget?.industry).personNounPlural.toLowerCase() }} and attendance records will be permanently removed.
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
import { INDUSTRY_LIST, getIndustry } from '../../industries'
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
const form = ref({ name: '', admin_name: '', admin_email: '', admin_password: '', industry: '' })

// 'industry' = step 0 (choose industry, create flow only), 'details' = the
// existing company/admin fields. Editing skips straight to 'details' since
// changing an existing company's industry is a bigger, separate operation
// (would affect its already-tracked people) and isn't handled here.
const createStep = ref('industry')
const industryList = INDUSTRY_LIST

function selectIndustry(key) {
  form.value.industry = key
}

const namePlaceholder = computed(() => {
  const samples = { school: 'Greenfield High School', company: 'Acme Logistics Ltd', business: 'Riverside Cafe', hospital: 'St. Mary\'s Medical Center', factory: 'Northgate Distribution Center', other: 'Riverside Organization' }
  return samples[form.value.industry] || samples.school
})

function openView(row) { viewTarget.value = row; showViewModal.value = true }

const cols = [
  { key: 'name', label: 'Company', sortable: true },
  { key: 'admin', label: 'Admin', hideMobile: true },
  { key: 'teachers', label: 'People Tracked', hideMobile: true },
  { key: 'present', label: 'Today', hideMobile: true },
  { key: 'status', label: 'Status', hideMobile: true },
  { key: 'created', label: 'Created', hideMobile: true },
  { key: 'actions', label: 'Actions' },
]

const miniStats = computed(() => {
  const active = props.schools.filter(s => s.status === 'active').length
  return [
    { icon: 'building', label: 'Total Companies', val: props.schools.length, color: 'var(--primary)' },
    { icon: 'check-circle', label: 'Active', val: active, color: 'var(--success)' },
    { icon: 'x-circle', label: 'Inactive', val: props.schools.length - active, color: 'var(--danger)' },
    { icon: 'teachers', label: 'Total People Tracked', val: props.schools.reduce((a, s) => a + (s.teacher_count || 0), 0), color: 'var(--accent)' },
  ]
})

function openCreate() { editing.value = false; createStep.value = 'industry'; form.value = { name: '', admin_name: '', admin_email: '', admin_password: '', industry: '' }; showModal.value = true }
function openEdit(row) { editing.value = true; createStep.value = 'details'; form.value = { ...row, admin_password: '', industry: row.industry || 'school' }; showModal.value = true }
function confirmDelete(row) { deleteTarget.value = row; showDeleteModal.value = true }

async function saveSchool() {
  saving.value = true
  try {
    if (editing.value) await api.put(`/schools/${form.value.id}`, form.value)
    else await api.post('/schools', form.value)
    toast.success(editing.value ? 'Company updated successfully' : 'Company created successfully')
    showModal.value = false; emit('refresh')
  } catch (e) { toast.error(e.response?.data?.message || e.response?.data?.error || 'Failed to save company') }
  finally { saving.value = false }
}

async function toggleStatus(row) {
  const newStatus = row.status === 'active' ? 'inactive' : 'active'
  try {
    await api.patch(`/schools/${row.id}/status`, { status: newStatus })
    toast.success(`Company ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
    emit('refresh')
  } catch { toast.error('Failed to update status') }
}

async function doDelete() {
  saving.value = true
  try {
    await api.delete(`/schools/${deleteTarget.value.id}`)
    toast.success('Company deleted')
    showDeleteModal.value = false; emit('refresh')
  } catch { toast.error('Failed to delete company') }
  finally { saving.value = false }
}

function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }
</script>

<style scoped>
.page-root { width: 100%; max-width: 100%; overflow-x: hidden; box-sizing: border-box; padding-right: 4px; padding-top: 4px; }
.section-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 12px; flex-wrap: wrap; padding-right: 12px; }

/* Override the global translateY hover for this button — it sits at the
   very top of the scroll area, so moving it upward on hover could clip
   under the topbar. Use a non-shifting scale + glow effect instead. */
.btn.btn-primary.btn-new-school:hover:not(:disabled) {
  transform: scale(1.035);
  box-shadow: 0 6px 22px var(--primary-glow);
}
.btn.btn-primary.btn-new-school:active:not(:disabled) {
  transform: scale(0.98);
}
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

/* Choose Industry step (create-company flow) */
.industry-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.industry-option {
  display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
  padding: 14px; border-radius: var(--radius); border: 1px solid var(--surface-border);
  background: var(--surface); cursor: pointer; text-align: left;
  transition: all var(--transition); font-family: inherit;
}
.industry-option:hover { border-color: var(--primary); background: rgba(37,99,235,0.04); }
.industry-option.selected { border-color: var(--primary); background: rgba(37,99,235,0.08); box-shadow: 0 0 0 1px var(--primary); }
.industry-icon-wrap {
  width: 36px; height: 36px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center;
  background: rgba(37,99,235,0.1); color: var(--primary); flex-shrink: 0;
}
.industry-option.selected .industry-icon-wrap { background: var(--primary); color: #fff; }
.industry-option-label { font-size: 14px; font-weight: 700; }
.industry-option-sub { font-size: 12px; color: var(--text-muted); margin-top: -4px; }
.industry-grid .form-actions { grid-column: 1 / -1; margin-top: 8px; }

.selected-industry-chip {
  display: flex; align-items: center; gap: 8px; align-self: flex-start;
  padding: 6px 10px; border-radius: 99px; background: rgba(37,99,235,0.08);
  color: var(--primary); font-size: 12px; font-weight: 700;
}
.chip-change-btn {
  margin-left: 4px; padding: 0; border: none; background: none; cursor: pointer;
  color: var(--primary); font-size: 12px; font-weight: 700; text-decoration: underline;
  font-family: inherit;
}
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
  .industry-grid { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .schools-stats { grid-template-columns: 1fr 1fr; gap: 8px; }
  .mini-stat { padding: 12px 12px; }
  .mini-val { font-size: 18px; }
}
</style>
