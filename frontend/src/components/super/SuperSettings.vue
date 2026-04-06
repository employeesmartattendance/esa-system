<template>
  <div class="ss-page">
    <!-- Header -->
    <div class="ss-header">
      <div>
        <h2 class="ss-title">Settings &amp; Profile</h2>
        <p class="ss-desc">Manage your account, security, and super admin team</p>
      </div>
    </div>

    <div class="ss-grid">

      <!-- ── My Profile ──────────────────────────────────────────── -->
      <div class="glass ss-card">
        <div class="ss-card-head">
          <div class="ss-card-icon" style="background:rgba(37,99,235,0.1)">
            <AppIcon name="user" :size="20" color="var(--primary)" />
          </div>
          <div>
            <div class="ss-card-title">My Profile</div>
            <div class="ss-card-desc">Update your display name and email</div>
          </div>
        </div>

        <!-- Avatar preview -->
        <div class="profile-preview">
          <div class="pp-avatar">{{ initials }}</div>
          <div class="pp-info">
            <div class="pp-name">{{ auth.user?.name }}</div>
            <div class="pp-email">{{ auth.user?.email }}</div>
            <div class="pp-role">
              <AppIcon name="shield" :size="11" color="var(--primary)" />
              Super Administrator
            </div>
          </div>
        </div>

        <form @submit.prevent="saveProfile" class="ss-form">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input v-model="profileForm.name" class="form-input" placeholder="Your full name" required />
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input v-model="profileForm.email" type="email" class="form-input" placeholder="your@email.com" required />
          </div>
          <button type="submit" class="btn btn-primary" :disabled="savingProfile">
            <span v-if="savingProfile" class="ss-spinner"></span>
            <AppIcon v-else name="check" :size="15" />
            {{ savingProfile ? 'Saving…' : 'Save Profile' }}
          </button>
        </form>
      </div>

      <!-- ── Change Password ─────────────────────────────────────── -->
      <div class="glass ss-card">
        <div class="ss-card-head">
          <div class="ss-card-icon" style="background:rgba(139,92,246,0.1)">
            <AppIcon name="key" :size="20" color="var(--info)" />
          </div>
          <div>
            <div class="ss-card-title">Change Password</div>
            <div class="ss-card-desc">Keep your account secure</div>
          </div>
        </div>

        <form @submit.prevent="changePassword" class="ss-form">
          <div class="form-group">
            <label class="form-label">Current Password</label>
            <div class="pw-row">
              <input v-model="pwForm.current" :type="show[0] ? 'text' : 'password'" class="form-input" required />
              <button type="button" class="pw-eye" @click="show[0] = !show[0]">
                <AppIcon name="eye" :size="14" color="var(--text-muted)" />
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">New Password</label>
            <div class="pw-row">
              <input v-model="pwForm.newPw" :type="show[1] ? 'text' : 'password'" class="form-input" required minlength="8" />
              <button type="button" class="pw-eye" @click="show[1] = !show[1]">
                <AppIcon name="eye" :size="14" color="var(--text-muted)" />
              </button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Confirm New Password</label>
            <div class="pw-row">
              <input v-model="pwForm.confirm" :type="show[2] ? 'text' : 'password'" class="form-input" required />
              <button type="button" class="pw-eye" @click="show[2] = !show[2]">
                <AppIcon name="eye" :size="14" color="var(--text-muted)" />
              </button>
            </div>
            <p v-if="pwForm.confirm && pwForm.newPw !== pwForm.confirm" class="pw-err">
              Passwords do not match
            </p>
          </div>
          <button type="submit" class="btn btn-primary"
            :disabled="savingPw || (pwForm.confirm && pwForm.newPw !== pwForm.confirm)">
            <span v-if="savingPw" class="ss-spinner"></span>
            <AppIcon v-else name="shield" :size="15" />
            {{ savingPw ? 'Updating…' : 'Update Password' }}
          </button>
        </form>
      </div>

      <!-- ── Super Admin Team (full width) ──────────────────────── -->
      <div class="glass ss-card ss-full">
        <div class="ss-card-head">
          <div class="ss-card-icon" style="background:rgba(6,182,212,0.1)">
            <AppIcon name="teachers" :size="20" color="var(--accent)" />
          </div>
          <div>
            <div class="ss-card-title">Super Admin Team</div>
            <div class="ss-card-desc">Manage all system administrators</div>
          </div>
          <button class="btn btn-primary btn-sm" style="margin-left:auto" @click="showAddModal = true">
            <AppIcon name="plus" :size="14" />Add Admin
          </button>
        </div>

        <div v-if="loadingAdmins" class="admins-loading">
          <div class="ss-spinner" style="border-top-color:var(--primary);border-color:var(--surface-border)"></div>
          Loading admins…
        </div>

        <div v-else-if="admins.length" class="admins-list">
          <div v-for="a in admins" :key="a.id" class="admin-row">
            <div class="admin-av">{{ a.name?.charAt(0)?.toUpperCase() }}</div>
            <div class="admin-details">
              <div class="admin-name">
                {{ a.name }}
                <span v-if="a.id === auth.user?.id" class="you-badge">You</span>
              </div>
              <div class="admin-email">{{ a.email }}</div>
              <div class="admin-meta">
                <AppBadge :variant="a.status === 'active' ? 'active' : 'inactive'" :label="a.status" dot />
                <span v-if="a.last_login" class="admin-last">Last: {{ fmtDate(a.last_login) }}</span>
              </div>
            </div>
            <button v-if="a.id !== auth.user?.id" class="admin-del-btn" @click="confirmDelete(a)">
              <AppIcon name="trash" :size="14" />
            </button>
          </div>
        </div>

        <EmptyState v-else icon="user" title="No admins found" message="Something went wrong loading admins." />
      </div>



    </div>

    <!-- Add Admin Modal -->
    <AppModal v-model="showAddModal" title="Create Super Admin"
      subtitle="This user will have full platform access" icon="shield">
      <form @submit.prevent="createAdmin" class="ss-form">
        <div class="form-group">
          <label class="form-label">Full Name *</label>
          <input v-model="adminForm.name" class="form-input" placeholder="Full name" required />
        </div>
        <div class="form-group">
          <label class="form-label">Email Address *</label>
          <input v-model="adminForm.email" type="email" class="form-input" placeholder="admin@email.com" required />
        </div>
        <div class="form-group">
          <label class="form-label">Password *</label>
          <input v-model="adminForm.password" type="password" class="form-input" placeholder="Minimum 8 characters" required minlength="8" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" @click="showAddModal = false">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="creating">
            <span v-if="creating" class="ss-spinner"></span>
            <AppIcon v-else name="plus" :size="15" />
            {{ creating ? 'Creating…' : 'Create Admin' }}
          </button>
        </div>
      </form>
    </AppModal>

    <!-- Delete Confirm Modal -->
    <AppModal v-model="showDeleteModal" title="Remove Admin"
      subtitle="This action cannot be undone" icon="trash" icon-color="var(--danger)">
      <p class="del-confirm-text">
        Remove <strong>{{ deleteTarget?.name }}</strong> ({{ deleteTarget?.email }}) from the system?
      </p>
      <div class="modal-actions">
        <button class="btn btn-ghost" @click="showDeleteModal = false">Cancel</button>
        <button class="btn btn-danger" @click="doDelete" :disabled="deleting">
          <AppIcon name="trash" :size="15" />Remove
        </button>
      </div>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppIcon    from '../ui/AppIcon.vue'
import AppModal   from '../ui/AppModal.vue'
import AppBadge   from '../ui/AppBadge.vue'
import EmptyState from '../ui/EmptyState.vue'
import { useAuthStore } from '../../stores/auth'
import { useToast }     from '../../composables/useToast'
import api from '../../api'

const auth  = useAuthStore()
const toast = useToast()

const initials = computed(() =>
  auth.user?.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'SA'
)

/* ── Profile ──────────────────────────────────────────────────────── */
const profileForm   = ref({ name: auth.user?.name || '', email: auth.user?.email || '' })
const savingProfile = ref(false)

async function saveProfile() {
  savingProfile.value = true
  try {
    const r = await api.put('/auth/profile', profileForm.value)
    const updated = r
    if (auth.user && updated) {
      auth.user.name  = updated.name  || profileForm.value.name
      auth.user.email = updated.email || profileForm.value.email
      localStorage.setItem('esa_user', JSON.stringify(auth.user))
    }
    toast.success('Profile updated successfully')
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed to update profile')
  } finally { savingProfile.value = false }
}

/* ── Password ─────────────────────────────────────────────────────── */
const pwForm    = ref({ current: '', newPw: '', confirm: '' })
const show      = ref([false, false, false])
const savingPw  = ref(false)

async function changePassword() {
  if (pwForm.value.newPw !== pwForm.value.confirm) {
    toast.error('Passwords do not match'); return
  }
  savingPw.value = true
  try {
    await api.put('/auth/change-password', {
      currentPassword: pwForm.value.current,
      newPassword:     pwForm.value.newPw,
    })
    pwForm.value = { current: '', newPw: '', confirm: '' }
    toast.success('Password updated successfully')
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed to update password')
  } finally { savingPw.value = false }
}

/* ── Admins ───────────────────────────────────────────────────────── */
const admins       = ref([])
const loadingAdmins = ref(false)
const showAddModal  = ref(false)
const creating      = ref(false)
const adminForm     = ref({ name: '', email: '', password: '' })

const showDeleteModal = ref(false)
const deleteTarget    = ref(null)
const deleting        = ref(false)

async function fetchAdmins() {
  loadingAdmins.value = true
  try {
    const r = await api.get('/super/admins')
    admins.value = Array.isArray(r) ? r : []
  } catch { admins.value = [] }
  finally { loadingAdmins.value = false }
}

async function createAdmin() {
  creating.value = true
  try {
    await api.post('/super/admins', adminForm.value)
    toast.success(`Admin account created for ${adminForm.value.name}`)
    adminForm.value    = { name: '', email: '', password: '' }
    showAddModal.value = false
    fetchAdmins()
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed to create admin')
  } finally { creating.value = false }
}

function confirmDelete(a) {
  deleteTarget.value    = a
  showDeleteModal.value = true
}

async function doDelete() {
  deleting.value = true
  try {
    await api.delete(`/super/admins/${deleteTarget.value.id}`)
    toast.success('Admin removed')
    showDeleteModal.value = false
    fetchAdmins()
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed to remove admin')
  } finally { deleting.value = false }
}



function fmtDate(d) {
  if (!d) return 'Never'
  return new Date(String(d).replace(' ', 'T')).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

onMounted(fetchAdmins)
</script>

<style scoped>
.ss-page { }
.ss-header { margin-bottom: 24px; }
.ss-title  { font-size: 22px; font-weight: 800; }
.ss-desc   { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

.ss-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
.ss-full { grid-column: span 2; }

.ss-card { padding: 22px; border-radius: var(--radius-lg); }

.ss-card-head { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
.ss-card-icon { width: 44px; height: 44px; border-radius: var(--radius); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ss-card-title { font-size: 15px; font-weight: 700; }
.ss-card-desc  { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

/* Profile preview */
.profile-preview {
  display: flex; align-items: center; gap: 14px;
  padding: 14px; margin-bottom: 18px;
  background: rgba(37,99,235,0.05);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius);
}
.pp-avatar {
  width: 52px; height: 52px; border-radius: 14px;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 20px; font-weight: 800; flex-shrink: 0;
}
.pp-name  { font-size: 15px; font-weight: 700; }
.pp-email { font-size: 12px; color: var(--text-muted); margin: 2px 0; }
.pp-role  {
  font-size: 11px; color: var(--primary); font-weight: 600;
  display: flex; align-items: center; gap: 4px; margin-top: 4px;
}

/* Form */
.ss-form { display: flex; flex-direction: column; gap: 14px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-secondary); }

.pw-row { position: relative; }
.pw-row .form-input { padding-right: 40px; }
.pw-eye {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer;
  display: flex; align-items: center; padding: 4px;
}
.pw-err { font-size: 12px; color: var(--danger); margin-top: 2px; }

/* Admins */
.admins-loading { display: flex; align-items: center; gap: 10px; padding: 20px 0; color: var(--text-muted); font-size: 13px; }
.admins-list { display: flex; flex-direction: column; gap: 10px; }
.admin-row {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 14px;
  background: rgba(37,99,235,0.03);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  transition: background 0.15s;
}
.admin-row:hover { background: rgba(37,99,235,0.06); }
.admin-av {
  width: 38px; height: 38px; border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 15px; font-weight: 700; flex-shrink: 0;
}
.admin-details { flex: 1; min-width: 0; }
.admin-name  { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 7px; }
.admin-email { font-size: 12px; color: var(--text-muted); margin: 2px 0; }
.admin-meta  { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.you-badge   {
  background: rgba(37,99,235,0.12); color: var(--primary);
  font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 99px;
}
.admin-last  { font-size: 11px; color: var(--text-muted); }
.admin-del-btn {
  width: 30px; height: 30px; border-radius: var(--radius-sm);
  border: 1px solid rgba(239,68,68,0.2); background: rgba(239,68,68,0.06);
  color: var(--danger); display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0; transition: all 0.15s;
}
.admin-del-btn:hover { background: var(--danger); color: #fff; }



/* Modal */
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
.del-confirm-text { font-size: 14px; color: var(--text-secondary); margin-bottom: 20px; line-height: 1.6; }

/* Spinner */
.ss-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: ssSpin 0.8s linear infinite;
}
@keyframes ssSpin { to { transform: rotate(360deg); } }

@media (max-width: 900px) { .ss-grid { grid-template-columns: 1fr; } .ss-full { grid-column: span 1; } }
</style>
