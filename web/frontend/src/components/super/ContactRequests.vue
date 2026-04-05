<template>
  <div class="cr-page">
    <!-- Header -->
    <div class="section-header">
      <div>
        <h2 class="section-title">Contact Requests</h2>
        <p class="section-desc">Manage incoming website contact requests</p>
      </div>
      <button class="btn btn-ghost btn-sm" @click="loadRequests">
        <AppIcon name="refresh" :size="15" /> Refresh
      </button>
    </div>

    <!-- Stats -->
    <div class="cr-stats">
      <div class="glass mini-stat" v-for="s in miniStats" :key="s.label">
        <AppIcon :name="s.icon" :size="18" :color="s.color" />
        <div>
          <div class="mini-val" :style="`color:${s.color}`">{{ s.val }}</div>
          <div class="mini-label">{{ s.label }}</div>
        </div>
      </div>
    </div>

    <!-- Filter tabs -->
    <div class="cr-tabs glass">
      <button
        v-for="t in tabs" :key="t.key"
        class="cr-tab"
        :class="{ active: activeTab === t.key }"
        @click="activeTab = t.key"
      >
        {{ t.label }}
        <span class="cr-tab-count">{{ countByStatus(t.key) }}</span>
      </button>
    </div>

    <!-- List -->
    <div class="glass cr-list-wrap">
      <div v-if="loading" class="cr-empty">
        <div class="spinner-lg"></div>
        <span style="color:var(--text-muted)">Loading requests...</span>
      </div>
      <div v-else-if="filtered.length === 0" class="cr-empty">
        <AppIcon name="bell" :size="32" color="var(--text-muted)" />
        <span style="color:var(--text-muted)">No {{ activeTab === 'all' ? '' : activeTab }} requests yet</span>
      </div>
      <div v-else class="cr-list">
        <div v-for="r in filtered" :key="r.id" class="cr-row">
          <!-- Avatar + info -->
          <div class="cr-avatar">{{ initials(r.full_name) }}</div>
          <div class="cr-info">
            <div class="cr-name">{{ r.full_name }}</div>
            <div class="cr-meta">
              <span class="cr-meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                {{ r.email }}
              </span>
              <span v-if="r.school_name" class="cr-meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                {{ r.school_name }}
              </span>
              <span v-if="r.phone" class="cr-meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16v.92z"/></svg>
                {{ r.phone }}
              </span>
            </div>
            <div v-if="r.message" class="cr-msg">{{ r.message }}</div>
          </div>

          <!-- Right: status + date + inline actions -->
          <div class="cr-right">
            <span class="cr-badge" :class="'cr-' + r.status">{{ r.status }}</span>
            <div class="cr-date">{{ formatDate(r.created_at) }}</div>
            <!-- Inline action buttons -->
            <div class="cr-inline-actions">
              <button class="cr-action-btn view" @click="openDetail(r)" title="View Details">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                View
              </button>
              <button
                v-if="r.status !== 'approved'"
                class="cr-action-btn approve"
                @click="quickAction(r, 'approved')"
                :disabled="quickLoading === r.id"
                title="Approve"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Approve
              </button>
              <button
                v-if="r.status !== 'rejected'"
                class="cr-action-btn reject"
                @click="quickAction(r, 'rejected')"
                :disabled="quickLoading === r.id"
                title="Reject"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Reject
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Modal (v-model) -->
    <AppModal
      v-model="showDetailModal"
      :title="'Request — ' + (selected?.full_name || '')"
      icon="bell"
      max-width="560px"
    >
      <div v-if="selected">
        <div class="detail-grid">
          <div class="detail-item">
            <div class="detail-label">Full Name</div>
            <div class="detail-val">{{ selected.full_name }}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Email</div>
            <div class="detail-val">
              <a :href="'mailto:'+selected.email" style="color:var(--primary)">{{ selected.email }}</a>
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Phone</div>
            <div class="detail-val">{{ selected.phone || '—' }}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">School</div>
            <div class="detail-val">{{ selected.school_name || '—' }}</div>
          </div>
          <div class="detail-item full-span">
            <div class="detail-label">Message</div>
            <div class="detail-val detail-message">{{ selected.message || '—' }}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Status</div>
            <div class="detail-val">
              <span class="cr-badge" :class="'cr-'+selected.status">{{ selected.status }}</span>
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Submitted</div>
            <div class="detail-val">{{ formatFull(selected.created_at) }}</div>
          </div>
        </div>

        <div class="form-group" style="margin-top:20px">
          <label class="form-label">Admin Notes
            <span style="font-weight:400;color:var(--text-muted);text-transform:none;font-size:11px"> — included in response email</span>
          </label>
          <textarea
            class="form-input"
            style="min-height:80px;resize:vertical"
            v-model="adminNotes"
            placeholder="Optional notes to include in the response email..."
          />
        </div>

        <div class="modal-actions">
          <button
            v-if="selected.status !== 'approved'"
            class="btn btn-success"
            :disabled="!!updating"
            @click="updateStatus('approved')"
          >
            <div v-if="updating === 'approved'" class="spinner-sm"></div>
            <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            {{ updating === 'approved' ? 'Approving…' : 'Approve' }}
          </button>
          <button
            v-if="selected.status !== 'rejected'"
            class="btn btn-danger"
            :disabled="!!updating"
            @click="updateStatus('rejected')"
          >
            <div v-if="updating === 'rejected'" class="spinner-sm"></div>
            <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            {{ updating === 'rejected' ? 'Rejecting…' : 'Reject' }}
          </button>
          <button
            v-if="selected.status !== 'pending'"
            class="btn btn-ghost"
            :disabled="!!updating"
            @click="updateStatus('pending')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            Reset
          </button>
          <button
            class="btn btn-ghost"
            style="margin-left:auto"
            @click="deleteRequest(selected.id)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import AppModal from '../ui/AppModal.vue'
import api from '../../api'
import { useToast } from '../../composables/useToast'

const { showToast } = useToast()
const localList       = ref([])
const loading         = ref(false)
const activeTab       = ref('all')
const showDetailModal = ref(false)
const selected        = ref(null)
const adminNotes      = ref('')
const updating        = ref(null)
const quickLoading    = ref(null)

onMounted(loadRequests)

async function loadRequests() {
  loading.value = true
  try {
    const r = await api.get('/super/contact-requests')
    localList.value = Array.isArray(r) ? r : []
  } catch {
    showToast({ type: 'error', message: 'Failed to load requests' })
  } finally {
    loading.value = false
  }
}

const tabs = [
  { key: 'all',      label: 'All'      },
  { key: 'pending',  label: 'Pending'  },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

const filtered = computed(() =>
  activeTab.value === 'all'
    ? localList.value
    : localList.value.filter(r => r.status === activeTab.value)
)

function countByStatus(key) {
  if (key === 'all') return localList.value.length
  return localList.value.filter(r => r.status === key).length
}

const miniStats = computed(() => [
  { icon: 'bell',        label: 'Total',    val: localList.value.length,                                             color: 'var(--primary)' },
  { icon: 'clock',       label: 'Pending',  val: localList.value.filter(r => r.status === 'pending').length,         color: 'var(--warning)' },
  { icon: 'check-circle',label: 'Approved', val: localList.value.filter(r => r.status === 'approved').length,        color: 'var(--success)' },
  { icon: 'x-circle',   label: 'Rejected', val: localList.value.filter(r => r.status === 'rejected').length,        color: 'var(--danger)'  },
])

function openDetail(r) {
  selected.value = { ...r }
  adminNotes.value = r.admin_notes || ''
  showDetailModal.value = true
}

// Quick inline approve/reject without opening modal
async function quickAction(row, status) {
  quickLoading.value = row.id
  try {
    await api.put(`/super/contact-requests/${row.id}`, { status, admin_notes: '' })
    const idx = localList.value.findIndex(r => r.id === row.id)
    if (idx !== -1) localList.value[idx].status = status
    showToast({ type: 'success', message: `Request ${status}. Email sent.` })
  } catch {
    showToast({ type: 'error', message: 'Action failed' })
  } finally {
    quickLoading.value = null
  }
}

async function updateStatus(status) {
  if (!selected.value) return
  updating.value = status
  try {
    await api.put(`/super/contact-requests/${selected.value.id}`, { status, admin_notes: adminNotes.value })
    const idx = localList.value.findIndex(r => r.id === selected.value.id)
    if (idx !== -1) {
      localList.value[idx].status = status
      localList.value[idx].admin_notes = adminNotes.value
    }
    selected.value.status = status
    showToast({ type: 'success', message: `Request ${status}. Email sent to requester.` })
  } catch {
    showToast({ type: 'error', message: 'Failed to update request' })
  } finally {
    updating.value = null
  }
}

async function deleteRequest(id) {
  if (!confirm('Delete this request permanently?')) return
  try {
    await api.delete(`/super/contact-requests/${id}`)
    localList.value = localList.value.filter(r => r.id !== id)
    showDetailModal.value = false
    showToast({ type: 'success', message: 'Request deleted' })
  } catch {
    showToast({ type: 'error', message: 'Delete failed' })
  }
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}
function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatFull(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.cr-page { width:100%; min-width:0; }

.section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:10px; }
.section-title  { font-size:22px; font-weight:800; }
.section-desc   { font-size:13px; color:var(--text-muted); margin-top:2px; }

/* Stats */
.cr-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:16px; }
.mini-stat {
  display:flex; align-items:center; gap:10px; padding:14px 18px;
  border-radius:var(--radius);
}
.mini-val   { font-size:22px; font-weight:800; }
.mini-label { font-size:11px; color:var(--text-muted); }

/* Tabs */
.cr-tabs { display:grid; grid-template-columns:repeat(4,1fr); gap:4px; padding:6px; border-radius:var(--radius); margin-bottom:12px; }
.cr-tab {
  padding:9px 10px; border:none;
  background:transparent; border-radius:var(--radius-sm); font-size:13px;
  font-weight:600; color:var(--text-muted); cursor:pointer;
  transition:all var(--transition); display:flex; align-items:center;
  justify-content:center; gap:6px; font-family:var(--font); white-space:nowrap;
}
.cr-tab.active { background:linear-gradient(135deg,var(--primary),var(--primary-dark)); color:#fff; }
.cr-tab-count {
  background:rgba(255,255,255,0.2); padding:1px 7px;
  border-radius:99px; font-size:11px;
}
.cr-tab:not(.active) .cr-tab-count { background:var(--bg-secondary); color:var(--text-muted); }

/* List container */
.cr-list-wrap { overflow:hidden; border-radius:var(--radius-lg); }
.cr-empty { display:flex; flex-direction:column; align-items:center; gap:14px; padding:56px 20px; }
.cr-list  { display:flex; flex-direction:column; }

/* Each row */
.cr-row {
  display:flex; align-items:flex-start; gap:12px;
  padding:16px 20px; border-bottom:1px solid var(--surface-border);
  transition:background var(--transition);
}
.cr-row:last-child { border-bottom:none; }
.cr-row:hover { background:rgba(37,99,235,0.04); }

.cr-avatar {
  width:40px; height:40px; border-radius:50%;
  background:linear-gradient(135deg,var(--primary),var(--accent));
  display:flex; align-items:center; justify-content:center;
  font-size:13px; font-weight:800; color:#fff; flex-shrink:0;
}
.cr-info  { flex:1; min-width:0; }
.cr-name  { font-size:15px; font-weight:700; margin-bottom:4px; }

.cr-meta  { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:6px; }
.cr-meta-item {
  display:flex; align-items:center; gap:4px;
  font-size:12px; color:var(--text-muted);
  max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.cr-msg {
  font-size:13px; color:var(--text-secondary);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  max-width:100%;
}

.cr-right {
  display:flex; flex-direction:column; align-items:flex-end;
  gap:5px; flex-shrink:0; min-width:120px;
}
.cr-date { font-size:11px; color:var(--text-muted); }

/* Inline action buttons */
.cr-inline-actions { display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end; margin-top:2px; }
.cr-action-btn {
  display:inline-flex; align-items:center; gap:4px;
  padding:4px 10px; border-radius:var(--radius-xs);
  font-size:11px; font-weight:700; border:none;
  cursor:pointer; transition:all var(--transition); font-family:var(--font);
  white-space:nowrap;
}
.cr-action-btn:disabled { opacity:.5; cursor:not-allowed; }
.cr-action-btn.view    { background:rgba(37,99,235,0.1); color:var(--primary); }
.cr-action-btn.view:hover:not(:disabled)   { background:var(--primary); color:#fff; }
.cr-action-btn.approve { background:rgba(16,185,129,0.12); color:var(--success); }
.cr-action-btn.approve:hover:not(:disabled){ background:var(--success); color:#fff; }
.cr-action-btn.reject  { background:rgba(239,68,68,0.1); color:var(--danger); }
.cr-action-btn.reject:hover:not(:disabled) { background:var(--danger); color:#fff; }

/* Badges */
.cr-badge { font-size:11px; font-weight:700; padding:3px 10px; border-radius:99px; text-transform:uppercase; letter-spacing:.04em; }
.cr-pending  { background:rgba(245,158,11,0.15); color:var(--warning); }
.cr-approved { background:rgba(16,185,129,0.15); color:var(--success); }
.cr-rejected { background:rgba(239,68,68,0.12); color:var(--danger);  }

/* Detail modal */
.detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.full-span   { grid-column:1/-1; }
.detail-item { display:flex; flex-direction:column; gap:4px; }
.detail-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); }
.detail-val   { font-size:14px; font-weight:500; word-break:break-word; }
.detail-message { line-height:1.65; color:var(--text-secondary); }

.form-group { display:flex; flex-direction:column; gap:6px; }
.form-label { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-secondary); }
.form-input {
  padding:11px 14px; background:var(--bg); border:1.5px solid var(--surface-border);
  border-radius:var(--radius-sm); color:var(--text); font-size:14px;
  font-family:var(--font); outline:none; transition:all var(--transition);
}
.form-input:focus { border-color:var(--primary); box-shadow:0 0 0 3px var(--primary-glow); }

.modal-actions { display:flex; align-items:center; gap:8px; margin-top:20px; flex-wrap:wrap; }

.spinner-sm {
  width:14px; height:14px; border:2px solid rgba(255,255,255,.3);
  border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite;
}
.spinner-lg {
  width:28px; height:28px; border:3px solid rgba(37,99,235,.2);
  border-top-color:var(--primary); border-radius:50%; animation:spin .8s linear infinite;
}
@keyframes spin { to { transform:rotate(360deg); } }

/* ── Responsive ── */
@media (max-width:700px) {
  .cr-row { flex-wrap:wrap; gap:10px; padding:14px 16px; }
  .cr-right { width:100%; flex-direction:row; align-items:center; justify-content:space-between; min-width:0; }
  .cr-inline-actions { flex-direction:row; justify-content:flex-start; flex-wrap:wrap; }
  /* Stats + tabs: 2x2 grid on mobile */
  .cr-stats { grid-template-columns:repeat(2,1fr); gap:8px; }
  .cr-tabs  { grid-template-columns:repeat(2,1fr); gap:4px; }
  .mini-stat { padding:12px 14px; }
  .mini-val  { font-size:18px; }
  .detail-grid { grid-template-columns:1fr; }
}
@media (max-width:480px) {
  .cr-right { flex-direction:column; align-items:flex-start; }
  .section-header { flex-direction:column; align-items:flex-start; }
  .cr-tab  { font-size:12px; padding:7px 8px; }
}
</style>
