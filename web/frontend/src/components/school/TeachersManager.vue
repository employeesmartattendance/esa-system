<template>
  <div class="page-root">
    <div class="section-header">
      <div>
        <h2 class="section-title">{{ groupVocab.personNounPlural }}</h2>
        <p class="section-desc">Manage {{ groupVocab.personNoun.toLowerCase() }} accounts and credentials</p>
      </div>
      <button class="btn btn-primary btn-add-person" @click="openCreate">
        <AppIcon name="plus" :size="16" />Add {{ groupVocab.personNoun }}
      </button>
    </div>

    <div class="glass">
      <DataTable :columns="cols" :rows="visibleTeachers" :loading="loading" searchable :search-placeholder="`Search ${groupVocab.personNounPlural.toLowerCase()}...`" empty-icon="teachers" :empty-title="`No ${groupVocab.personNounPlural.toLowerCase()} yet`" :empty-message="`Add your first ${groupVocab.personNoun.toLowerCase()} to get started.`">
        <template #actions>
          <button class="btn btn-ghost btn-sm" @click="$emit('refresh')"><AppIcon name="refresh" :size="14" />Refresh</button>
        </template>
        <template #cell-name="{ row }">
          <div class="teacher-cell">
            <div class="t-avatar">
              <img v-if="resolveAvatar(row.avatar)" :src="resolveAvatar(row.avatar)" :alt="row.name" class="t-avatar-img" />
              <span v-else>{{ row.name?.charAt(0) }}</span>
            </div>
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
        <template #cell-biometric="{ row }">
          <AppBadge :variant="row.biometric_enrolled ? 'active' : 'inactive'" :label="row.biometric_enrolled ? 'Enrolled' : 'Not set up'" dot />
        </template>
        <template #cell-actions="{ row }">
          <div class="row-actions">
            <button class="icon-btn" title="View details" @click="openView(row)"><AppIcon name="eye" :size="15" /></button>
            <button class="icon-btn" title="Edit" @click="openEdit(row)"><AppIcon name="edit" :size="15" /></button>
            <button v-if="row.biometric_enrolled" class="icon-btn" title="Reset biometric enrollment" :disabled="resettingBiometricId === row.teacher_id" @click="resetBiometric(row)"><AppIcon name="shield" :size="15" /></button>
            <button class="icon-btn danger" title="Delete" @click="confirmDelete(row)"><AppIcon name="trash" :size="15" /></button>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- View Details Modal -->
    <AppModal v-model="showViewModal" :title="`${groupVocab.personNoun} Details`" icon="user" max-width="480px">
      <div v-if="viewTarget" class="view-detail-grid">
        <div v-if="resolveAvatar(viewTarget.avatar)" class="view-avatar-preview">
          <img :src="resolveAvatar(viewTarget.avatar)" :alt="viewTarget.name" />
        </div>
        <div class="vd-row"><span class="vd-label">Name</span><span class="vd-val">{{ viewTarget.name }}</span></div>
        <div class="vd-row"><span class="vd-label">Email</span><span class="vd-val">{{ viewTarget.email }}</span></div>
        <div class="vd-row"><span class="vd-label">Phone</span><span class="vd-val">{{ viewTarget.phone || '—' }}</span></div>
        <div class="vd-row"><span class="vd-label">Subject</span><span class="vd-val">{{ viewTarget.subject || '—' }}</span></div>
        <div class="vd-row"><span class="vd-label">Today</span><span class="vd-val"><AppBadge :variant="viewTarget.today_status||'absent'" :label="viewTarget.today_status||'absent'" dot /></span></div>
        <div class="vd-row"><span class="vd-label">Biometric</span><span class="vd-val"><AppBadge :variant="viewTarget.biometric_enrolled ? 'active' : 'inactive'" :label="viewTarget.biometric_enrolled ? 'Enrolled' : 'Not set up'" dot /></span></div>
        <div class="vd-row"><span class="vd-label">Status</span><span class="vd-val"><AppBadge :variant="viewTarget.status==='active'?'active':'inactive'" :label="viewTarget.status||'active'" dot /></span></div>
        <div class="vd-row"><span class="vd-label">Check In</span><span class="vd-val">{{ viewTarget.check_in || '—' }}</span></div>
      </div>
      <div class="form-actions"><button class="btn btn-ghost" @click="showViewModal=false">Close</button><button class="btn btn-primary" @click="showViewModal=false;openEdit(viewTarget)"><AppIcon name="edit" :size="14"/>Edit</button></div>
    </AppModal>

    <!-- Create/Edit Modal -->
    <AppModal v-model="showModal" :title="editing ? `Edit ${groupVocab.personNoun}` : `Add ${groupVocab.personNoun}`" icon="user" max-width="580px">
      <form @submit.prevent="save" class="modal-form">
        <div class="form-group">
          <label class="form-label">{{ groupVocab.personNoun }} Photo</label>
          <div class="avatar-upload-row">
            <div class="avatar-preview">
              <img v-if="avatarPreviewUrl" :src="avatarPreviewUrl" alt="Profile photo" class="avatar-preview-img" />
              <AppIcon v-else name="user" :size="22" color="var(--text-muted)" />
              <div v-if="uploadingAvatar" class="avatar-uploading"><span class="btn-spinner-sm" style="border-color:rgba(255,255,255,0.4);border-top-color:#fff"></span></div>
            </div>
            <div class="avatar-upload-actions">
              <button type="button" class="btn btn-ghost btn-sm" :disabled="uploadingAvatar" @click="triggerAvatarPicker">
                <AppIcon name="camera" :size="13" />{{ form.avatar ? 'Change Photo' : 'Upload Photo' }}
              </button>
              <button v-if="form.avatar" type="button" class="btn-link-remove" :disabled="uploadingAvatar" @click="removeAvatar">Remove</button>
              <input ref="avatarFileInput" type="file" accept="image/*" class="hidden-file-input" @change="onAvatarSelected" />
            </div>
          </div>
          <p v-if="avatarError" class="field-warning"><AppIcon name="alert-triangle" :size="13" />{{ avatarError }}</p>
        </div>
        <div class="form-row two-col">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input v-model="form.name" class="form-input" :placeholder="`${groupVocab.personNoun}'s full name`" required />
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
            {{ editing ? 'Save Changes' : `Add ${groupVocab.personNoun}` }}
          </button>
        </div>
      </form>
    </AppModal>

    <!-- Delete confirm -->
    <AppModal v-model="showDeleteModal" :title="`Remove ${groupVocab.personNoun}`" subtitle="This cannot be undone" icon="trash" icon-color="var(--danger)">
      <p style="font-size:14px;color:var(--text-secondary);margin-bottom:20px">
        Remove <strong>{{ deleteTarget?.name }}</strong> from this {{ vocab.orgNoun.toLowerCase() }}? Their attendance records will be kept.
      </p>
      <div class="form-actions">
        <button class="btn btn-ghost" @click="showDeleteModal=false">Cancel</button>
        <button class="btn btn-danger" @click="doDelete" :disabled="saving"><AppIcon name="trash" :size="15" />Remove</button>
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
import { useIndustry } from '../../composables/useIndustry'
import { getIndustry } from '../../industries'
import api from '../../api'

const props = defineProps({
  teachers: { type: Array, default: () => [] },
  loading: Boolean,
  schoolId: [Number, String],
  // Which tracked-people group this instance manages. 'primary' is the
  // original/default group (all pre-existing teachers already have this
  // via the backend's default), so passing nothing preserves the exact
  // original behavior — every teacher shows, nothing is filtered out.
  group: { type: String, default: 'primary' },
})
const emit = defineEmits(['refresh'])
const toast = useToast()
const { vocab } = useIndustry()

// When this instance manages the secondary group (e.g. "Contractors" for a
// company), all the person-noun text should reflect that group's label
// instead of the industry's primary person-noun.
const groupVocab = computed(() => {
  const sg = vocab.value.secondaryGroup
  if (props.group !== 'primary' && sg) {
    return { personNoun: sg.label, personNounPlural: sg.labelPlural }
  }
  return { personNoun: vocab.value.personNoun, personNounPlural: vocab.value.personNounPlural }
})

const visibleTeachers = computed(() =>
  props.group === 'primary'
    ? props.teachers
    : props.teachers.filter(t => t.group === props.group)
)

const API = import.meta.env.VITE_API_URL || 'https://esa-system.onrender.com/api'
const apiBase = API.replace('/api', '')
function resolveAvatar(url) {
  if (!url) return null
  if (url.startsWith('http') || url.startsWith('//')) return url
  return `${apiBase}${url}`
}

const showModal = ref(false)
const showDeleteModal = ref(false)
const showViewModal = ref(false)
const viewTarget = ref(null)
const editing = ref(false)
const saving = ref(false)
const deleteTarget = ref(null)
const form = ref({ name: '', email: '', phone: '', subject: '', password: '', group: 'primary', avatar: '' })

// ── Photo upload ─────────────────────────────────────────────────────
const avatarFileInput = ref(null)
const uploadingAvatar = ref(false)
const avatarError = ref('')
// Local data-URL preview shown instantly while the upload is in flight —
// swapped for the real saved URL once the upload response comes back.
const localAvatarPreview = ref('')
const avatarPreviewUrl = computed(() => resolveAvatar(localAvatarPreview.value || form.value.avatar))

function triggerAvatarPicker() {
  avatarError.value = ''
  avatarFileInput.value?.click()
}

async function onAvatarSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  avatarError.value = ''

  if (!file.type.startsWith('image/')) {
    avatarError.value = 'Please select an image file'
    e.target.value = ''
    return
  }

  const reader = new FileReader()
  reader.onload = (ev) => { localAvatarPreview.value = ev.target.result }
  reader.readAsDataURL(file)

  uploadingAvatar.value = true
  try {
    const fd = new FormData()
    fd.append('avatar', file)
    // No timeout override needed here — the shared api client no longer
    // applies a fixed timeout to upload (multipart/form-data) requests, so
    // large photos are given as long as they need to finish uploading.
    const r = await api.post('/teachers/upload-avatar', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    form.value.avatar = r?.relative_avatar_url || r?.avatar_url || ''
    localAvatarPreview.value = ''
  } catch (err) {
    localAvatarPreview.value = ''
    avatarError.value = err.response?.data?.message || 'Failed to upload photo'
  } finally {
    uploadingAvatar.value = false
    e.target.value = ''
  }
}

function removeAvatar() {
  form.value.avatar = ''
  localAvatarPreview.value = ''
  avatarError.value = ''
}

function openView(row) { viewTarget.value = row; showViewModal.value = true }

const cols = computed(() => [
  { key: 'name', label: groupVocab.value.personNoun, sortable: true },
  { key: 'subject', label: 'Subject', hideMobile: true },
  { key: 'phone', label: 'Phone', hideMobile: true },
  { key: 'today', label: "Today's Status", hideMobile: true },
  { key: 'biometric', label: 'Biometric', hideMobile: true },
  { key: 'status', label: 'Account', hideMobile: true },
  { key: 'actions', label: 'Actions' },
])

const resettingBiometricId = ref(null)
async function resetBiometric(row) {
  if (!confirm(`Reset biometric enrollment for ${row.name}? They'll need to set it up again on their device before their next check-in.`)) return
  resettingBiometricId.value = row.teacher_id
  try {
    await api.delete(`/biometric/credential/${row.teacher_id}`)
    toast.success('Biometric enrollment reset')
    emit('refresh')
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed to reset biometric enrollment')
  } finally {
    resettingBiometricId.value = null
  }
}

function openCreate() { editing.value = false; form.value = { name: '', email: '', phone: '', subject: '', password: '', group: props.group, avatar: '' }; localAvatarPreview.value = ''; avatarError.value = ''; showModal.value = true }
function openEdit(row) { editing.value = true; form.value = { ...row, password: '', avatar: row.avatar || '' }; localAvatarPreview.value = ''; avatarError.value = ''; showModal.value = true }
function confirmDelete(row) { deleteTarget.value = row; showDeleteModal.value = true }

async function save() {
  saving.value = true
  try {
    if (editing.value) await api.put(`/teachers/${form.value.id}`, form.value)
    else await api.post('/teachers', form.value)
    toast.success(editing.value ? `${groupVocab.value.personNoun} updated` : `${groupVocab.value.personNoun} added successfully`)
    showModal.value = false; emit('refresh')
  } catch (e) { toast.error(e.response?.data?.message || e.response?.data?.error || `Failed to save ${groupVocab.value.personNoun.toLowerCase()}`) }
  finally { saving.value = false }
}

async function doDelete() {
  saving.value = true
  try {
    await api.delete(`/teachers/${deleteTarget.value.id}`)
    toast.success(`${groupVocab.value.personNoun} removed`)
    showDeleteModal.value = false; emit('refresh')
  } catch { toast.error(`Failed to remove ${groupVocab.value.personNoun.toLowerCase()}`) }
  finally { saving.value = false }
}
</script>

<style scoped>
.page-root { width: 100%; max-width: 100%; overflow-x: hidden; box-sizing: border-box; padding-right: 4px; }
.glass { width: 100%; min-width: 0; overflow: hidden; box-sizing: border-box; margin-right: 12px; }
.section-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; padding-right: 12px; }
/* Override the global translateY hover for this button — it sits at the
   very top of the scroll area, so moving it upward on hover could clip
   under the topbar. Use a non-shifting scale + glow effect instead
   (matches the "+ New Company" button on the super admin Companies page). */
.btn.btn-primary.btn-add-person:hover:not(:disabled) {
  transform: scale(1.035);
  box-shadow: 0 6px 22px var(--primary-glow);
}
.btn.btn-primary.btn-add-person:active:not(:disabled) {
  transform: scale(0.98);
}
.section-title { font-size: 22px; font-weight: 800; }
.section-desc { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
.teacher-cell { display: flex; align-items: center; gap: 10px; min-width: 0; overflow: hidden; }
.t-avatar { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--primary), var(--accent)); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 14px; flex-shrink: 0; overflow: hidden; }
.t-avatar-img { width: 100%; height: 100%; object-fit: cover; }
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

/* Employee photo upload */
.avatar-upload-row { display: flex; align-items: center; gap: 14px; }
.avatar-preview {
  width: 56px; height: 56px; border-radius: 50%; flex-shrink: 0;
  background: var(--surface); border: 1px solid var(--surface-border);
  display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;
}
.avatar-preview-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.avatar-uploading { position: absolute; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; }
.avatar-upload-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.hidden-file-input { display: none; }
.field-warning { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; color: var(--warning, #d97706); margin-top: 8px; line-height: 1.5; }
.field-warning :deep(svg) { flex-shrink: 0; margin-top: 2px; }
.btn-link-remove {
  padding: 0; border: none; background: none; cursor: pointer;
  color: var(--danger); font-size: 12px; font-weight: 700; text-decoration: underline;
  font-family: inherit;
}
.btn-link-remove:disabled { opacity: 0.5; cursor: not-allowed; }

/* View detail modal */
.view-detail-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.view-avatar-preview { display: flex; justify-content: center; margin-bottom: 4px; }
.view-avatar-preview img { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 1px solid var(--surface-border); }
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
