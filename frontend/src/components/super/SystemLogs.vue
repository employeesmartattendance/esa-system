<template>
  <div class="page-root">
    <div class="section-header">
      <div>
        <h2 class="section-title">System Logs</h2>
        <p class="section-desc">Full audit trail of all platform activity</p>
      </div>
      <button class="btn btn-ghost btn-sm" @click="$emit('refresh')">
        <AppIcon name="refresh" :size="14" />Refresh
      </button>
    </div>
    <div class="glass table-glass">
      <DataTable :columns="cols" :rows="logs" :loading="loading" searchable search-placeholder="Search logs..." empty-icon="log" empty-title="No logs yet">
        <template #cell-action="{ row }">
          <div class="action-cell">
            <div class="action-dot" :class="actionClass(row.action)"></div>
            <span class="action-text">{{ row.action }}</span>
          </div>
        </template>
        <template #cell-user="{ row }">
          <span class="fw-500">{{ row.user_name || 'System' }}</span>
        </template>
        <template #cell-role="{ row }">
          <AppBadge :variant="roleBadge(row.user_role)" :label="row.user_role || 'system'" />
        </template>
        <template #cell-time="{ row }">
          <span class="text-muted text-sm">{{ formatDate(row.timestamp) }}</span>
        </template>
        <template #cell-actions="{ row }">
          <button class="icon-btn" title="View details" @click="openView(row)">
            <AppIcon name="eye" :size="15" />
          </button>
        </template>
      </DataTable>
    </div>

    <!-- View Log Modal -->
    <AppModal v-model="showViewModal" title="Log Details" icon="log" max-width="460px">
      <div v-if="viewTarget" class="view-detail-grid">
        <div class="vd-row"><span class="vd-label">Action</span><span class="vd-val">{{ viewTarget.action }}</span></div>
        <div class="vd-row"><span class="vd-label">User</span><span class="vd-val">{{ viewTarget.user_name || 'System' }}</span></div>
        <div class="vd-row"><span class="vd-label">Role</span><span class="vd-val"><AppBadge :variant="roleBadge(viewTarget.user_role)" :label="viewTarget.user_role || 'system'" /></span></div>
        <div class="vd-row"><span class="vd-label">Time</span><span class="vd-val">{{ formatDate(viewTarget.timestamp) }}</span></div>
        <div class="vd-row" v-if="viewTarget.details"><span class="vd-label">Details</span><span class="vd-val vd-wrap">{{ viewTarget.details }}</span></div>
        <div class="vd-row" v-if="viewTarget.ip_address"><span class="vd-label">IP</span><span class="vd-val">{{ viewTarget.ip_address }}</span></div>
      </div>
      <div class="form-actions"><button class="btn btn-ghost" @click="showViewModal=false">Close</button></div>
    </AppModal>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import DataTable from '../ui/DataTable.vue'
import AppBadge from '../ui/AppBadge.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppModal from '../ui/AppModal.vue'

defineProps({ logs: { type: Array, default: () => [] }, loading: Boolean })
defineEmits(['refresh'])

const showViewModal = ref(false)
const viewTarget = ref(null)
function openView(row) { viewTarget.value = row; showViewModal.value = true }

const cols = [
  { key: 'id', label: '#', hideMobile: true, width: '6%' },
  { key: 'action', label: 'Action', sortable: true, width: '28%' },
  { key: 'user', label: 'User', hideMobile: true, width: '18%' },
  { key: 'role', label: 'Role', hideMobile: true, width: '12%' },
  { key: 'time', label: 'Time', sortable: true, hideMobile: true, width: '18%' },
  { key: 'actions', label: '' },
]

function actionClass(action = '') {
  if (action.toLowerCase().includes('delete') || action.toLowerCase().includes('error')) return 'dot-danger'
  if (action.toLowerCase().includes('create') || action.toLowerCase().includes('login')) return 'dot-success'
  if (action.toLowerCase().includes('update')) return 'dot-warning'
  return 'dot-info'
}

function roleBadge(role) {
  if (role === 'super_admin') return 'primary'
  if (role === 'school_admin') return 'info'
  if (role === 'teacher') return 'success'
  return 'warning'
}

function formatDate(d) {
  return d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
}
</script>

<style scoped>
.page-root { width: 100%; max-width: 100%; overflow-x: hidden; box-sizing: border-box; padding-right: 4px; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px; flex-wrap: wrap; padding-right: 12px; }
.section-title { font-size: 22px; font-weight: 800; }
.section-desc { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
.table-glass { width: 100%; min-width: 0; overflow: hidden; box-sizing: border-box; margin-right: 12px; }
.action-cell { display: flex; align-items: center; gap: 8px; font-size: 13px; min-width: 0; overflow: hidden; }
.action-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.action-text { overflow: hidden; text-overflow: ellipsis; white-space: normal; word-break: break-word; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.dot-danger  { background: var(--danger); box-shadow: 0 0 0 2px rgba(239,68,68,0.2); }
.dot-success { background: var(--success); box-shadow: 0 0 0 2px rgba(16,185,129,0.2); }
.dot-warning { background: var(--warning); box-shadow: 0 0 0 2px rgba(245,158,11,0.2); }
.dot-info    { background: var(--primary); box-shadow: 0 0 0 2px rgba(37,99,235,0.2); }
.fw-500 { font-weight: 500; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: normal; word-break: break-word; }
.text-muted { color: var(--text-muted); }
.text-sm { font-size: 13px; }
.icon-btn { width: 30px; height: 30px; border-radius: var(--radius-sm); border: 1px solid var(--surface-border); background: var(--surface); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all var(--transition); flex-shrink: 0; }
.icon-btn:hover { border-color: var(--primary); color: var(--primary); }
.view-detail-grid { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.vd-row { display: flex; align-items: flex-start; gap: 12px; padding: 10px 12px; background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-sm); overflow: hidden; }
.vd-label { font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; min-width: 70px; padding-top: 1px; flex-shrink: 0; }
.vd-val { font-size: 13px; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; word-break: break-word; }
.vd-wrap { word-break: break-all; white-space: pre-wrap; font-weight: 400; }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; }
@media (max-width: 768px) {
  .page-root { padding-right: 0; }
  .section-header { flex-direction: column; align-items: flex-start; padding-right: 0; }
  .section-header .btn { width: 100%; justify-content: center; }
  .table-glass { margin-right: 0; }
}
</style>
