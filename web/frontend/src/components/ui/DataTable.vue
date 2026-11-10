<template>
  <div class="data-table-wrap">
    <!-- Toolbar -->
    <div v-if="searchable || $slots.actions" class="table-toolbar">
      <div v-if="searchable" class="table-search">
        <AppIcon name="search" :size="16" color="var(--text-muted)" />
        <input
          v-model="searchQuery"
          :placeholder="searchPlaceholder || 'Search...'"
          class="search-input"
        />
      </div>
      <div class="table-actions">
        <slot name="actions" />
      </div>
    </div>

    <!-- Table -->
    <div class="table-scroll">
      <table>
        <thead v-if="paginatedRows.length">
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              :class="{ sortable: col.sortable, 'hide-mobile': col.hideMobile, 'col-actions': col.key === 'actions' }"
              @click="col.sortable ? toggleSort(col.key) : null"
            >
              <div class="th-inner">
                {{ col.label }}
                <span v-if="col.sortable" class="sort-icon">
                  <AppIcon
                    :name="sortKey === col.key ? (sortDir === 'asc' ? 'trending-up' : 'trending-up') : 'filter'"
                    :size="12"
                    :color="sortKey === col.key ? 'var(--primary)' : 'var(--text-muted)'"
                  />
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
        <tr v-if="loading && !paginatedRows.length && showDelayedLoading" class="loading-row">
          <td :colspan="columns.length" class="table-loading-cell">
            <div class="table-loading-inner">
              <div class="spinner-ring">
                <div></div><div></div><div></div><div></div>
              </div>
              <span class="loading-text">Loading...</span>
            </div>
          </td>
        </tr>
          <tr v-else-if="loading && !paginatedRows.length">
            <td :colspan="columns.length"><div class="initial-load-placeholder"></div></td>
          </tr>
          <tr v-else-if="!paginatedRows.length">
            <td :colspan="columns.length">
              <EmptyState :icon="emptyIcon || 'search'" :title="emptyTitle || 'No results'" :message="emptyMessage || ''" />
            </td>
          </tr>
          <template v-else>
            <tr v-for="(row, idx) in paginatedRows" :key="row.id ?? row._id ?? `${page}-${idx}`" class="table-row">
              <td
                v-for="col in columns"
                :key="col.key"
                :class="{ 'hide-mobile': col.hideMobile, 'col-actions': col.key === 'actions' }"
              >
                <div class="td-content" :title="col.rowIndex ? undefined : row[col.key]">
                  <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]" :index="startRow + idx">
                    <template v-if="col.rowIndex">{{ startRow + idx }}</template>
                    <template v-else>{{ truncateText(row[col.key], col.truncateLength || 8) ?? '–' }}</template>
                  </slot>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Mobile record cards: same source rows and cell slots as the desktop table. -->
    <div class="mobile-record-list">
      <div v-if="quickFilterOptions.length" class="mobile-filter-strip" role="tablist" aria-label="Filter records">
        <button
          v-for="option in quickFilterOptions"
          :key="option.value"
          type="button"
          class="mobile-filter-chip"
          :class="{ active: activeQuickFilter === option.value }"
          :aria-selected="activeQuickFilter === option.value"
          @click="activeQuickFilter = option.value; page = 1"
        >{{ option.label }}</button>
      </div>
      <div v-if="loading && !paginatedRows.length && showDelayedLoading" class="mobile-record-loading">
        <span class="spinner"></span>
      </div>
      <div v-else-if="loading && !paginatedRows.length" class="mobile-record-loading-placeholder"></div>
      <EmptyState
        v-else-if="!paginatedRows.length"
        :icon="emptyIcon || 'search'"
        :title="emptyTitle || 'No results'"
        :message="emptyMessage || ''"
      />
      <article
        v-for="(row, idx) in paginatedRows"
        :key="row.id ?? row._id ?? `${page}-${idx}`"
        class="mobile-record-card"
        :class="{ 'is-expanded': expandedRowKey === rowKey(row, idx) }"
      >
        <button type="button" class="mobile-record-card__header" :aria-expanded="expandedRowKey === rowKey(row, idx)" @click="toggleMobileDetails(row, idx)">
          <div class="mobile-record-card__topline">
            <span v-if="statusColumn" class="mobile-record-card__status">
              <slot :name="`cell-${statusColumn.key}`" :row="row" :value="row[statusColumn.key]" :index="startRow + idx">{{ humanizeValue(row[statusColumn.key]) }}</slot>
            </span>
            <span class="mobile-record-card__chevron"><AppIcon :name="expandedRowKey === rowKey(row, idx) ? 'chevron-up' : 'chevron-down'" :size="17" /></span>
          </div>
          <div class="mobile-record-card__title">
            <slot v-if="primaryColumn" :name="`cell-${primaryColumn.key}`" :row="row" :value="row[primaryColumn.key]" :index="startRow + idx">{{ humanizeValue(row[primaryColumn.key]) }}</slot>
            <span v-else>Record {{ startRow + idx }}</span>
          </div>
          <div v-if="secondaryColumn" class="mobile-record-card__subtitle">
            <slot :name="`cell-${secondaryColumn.key}`" :row="row" :value="row[secondaryColumn.key]" :index="startRow + idx">{{ humanizeValue(row[secondaryColumn.key]) }}</slot>
          </div>
        </button>
        <div class="mobile-record-card__preview" v-if="previewColumns.length">
          <div v-for="col in previewColumns" :key="col.key" class="mobile-record-card__preview-row">
            <span>{{ col.label }}</span>
            <strong><slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]" :index="startRow + idx">{{ humanizeValue(row[col.key]) }}</slot></strong>
          </div>
        </div>
        <div v-if="expandedRowKey === rowKey(row, idx)" class="mobile-record-card__expanded">
          <div v-for="col in expandedColumns" :key="col.key" class="mobile-record-card__detail-row">
            <span>{{ col.label || col.key }}</span>
            <strong><slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]" :index="startRow + idx">{{ humanizeValue(row[col.key]) }}</slot></strong>
          </div>
        </div>
        <div class="mobile-record-card__actions">
          <button type="button" class="btn btn-primary btn-sm" @click="openMobileDetails(row, idx)"><AppIcon name="eye" :size="14" />View more</button>
          <button type="button" class="btn btn-ghost btn-sm" @click="toggleMobileDetails(row, idx)"><AppIcon :name="expandedRowKey === rowKey(row, idx) ? 'chevron-up' : 'list'" :size="14" />{{ expandedRowKey === rowKey(row, idx) ? 'Less' : 'Details' }}</button>
        </div>
      </article>
    </div>

    <AppModal v-model="showMobileDetails" :title="mobileDetailsTitle" icon="file-text" max-width="560px">
      <div v-if="selectedMobileRow" class="mobile-record-modal-details">
        <div v-for="col in modalColumns" :key="col.key" class="mobile-record-modal-row">
          <span>{{ col.label || col.key }}</span>
          <strong><slot :name="`cell-${col.key}`" :row="selectedMobileRow" :value="selectedMobileRow[col.key]" :index="selectedMobileIndex">{{ humanizeValue(selectedMobileRow[col.key]) }}</slot></strong>
        </div>
        <div v-if="$slots['cell-actions']" class="mobile-record-modal-actions">
          <div class="mobile-record-modal-actions__label">Available actions</div>
          <slot name="cell-actions" :row="selectedMobileRow" :value="selectedMobileRow" :index="selectedMobileIndex" />
        </div>
      </div>
    </AppModal>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="table-pagination">
      <span class="pagination-info">
        Showing {{ startRow }}–{{ endRow }} of {{ filteredRows.length }}
      </span>
      <div class="pagination-controls">
        <button class="page-btn" :disabled="page === 1" @click="page--">
          <AppIcon name="filter" :size="14" />
        </button>
        <button
          v-for="p in visiblePages"
          :key="p"
          class="page-btn"
          :class="{ active: p === page }"
          @click="page = p"
        >{{ p }}</button>
        <button class="page-btn" :disabled="page === totalPages" @click="page++">
          <AppIcon name="filter" :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import EmptyState from './EmptyState.vue'
import AppModal from './AppModal.vue'
import { useDelayedLoading } from '../../composables/useDelayedLoading'

const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, default: () => [] },
  loading: Boolean,
  searchable: Boolean,
  searchPlaceholder: String,
  pageSize: { type: Number, default: 10 },
  emptyIcon: String,
  emptyTitle: String,
  emptyMessage: String,
})

const showDelayedLoading = useDelayedLoading(() => props.loading, 180)
const searchQuery = ref('')
const sortKey = ref('')
const sortDir = ref('asc')
const page = ref(1)
const activeQuickFilter = ref('all')
const expandedRowKey = ref(null)
const showMobileDetails = ref(false)
const selectedMobileRow = ref(null)
const selectedMobileIndex = ref(0)

watch(searchQuery, () => { page.value = 1 })

function truncateText(text, maxLength = 8) {
  if (!text) return ''
  const str = String(text)
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str
}

function toggleSort(key) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = key; sortDir.value = 'asc' }
}

const quickFilterField = computed(() => {
  const candidates = ['status', 'today_status', 'subscription_status', 'user_role']
  return candidates.find(key => props.columns.some(col => col.key === key) && new Set((props.rows || []).map(row => row?.[key]).filter(value => value !== null && value !== undefined && value !== '')).size >= 2) || ''
})
const quickFilterOptions = computed(() => {
  if (!quickFilterField.value) return []
  const values = [...new Set((props.rows || []).map(row => row?.[quickFilterField.value]).filter(value => value !== null && value !== undefined && value !== ''))].slice(0, 7)
  if (values.length < 2) return []
  return [{ value: 'all', label: 'All' }, ...values.map(value => ({ value: String(value), label: humanizeValue(value) }))]
})

const filteredRows = computed(() => {
  let rows = Array.isArray(props.rows) ? [...props.rows] : []
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    rows = rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)))
  }
  if (quickFilterField.value && activeQuickFilter.value !== 'all') {
    rows = rows.filter(row => String(row?.[quickFilterField.value]) === activeQuickFilter.value)
  }
  if (sortKey.value) {
    rows.sort((a, b) => {
      const va = a[sortKey.value], vb = b[sortKey.value]
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
      return sortDir.value === 'asc' ? cmp : -cmp
    })
  }
  return rows
})

const totalPages = computed(() => Math.ceil(filteredRows.value.length / props.pageSize))
watch(totalPages, (tp) => { if (page.value > tp) page.value = Math.max(1, tp) })
const startRow = computed(() => (page.value - 1) * props.pageSize + 1)
const endRow = computed(() => Math.min(page.value * props.pageSize, filteredRows.value.length))
const paginatedRows = computed(() => filteredRows.value.slice(startRow.value - 1, endRow.value))
const visiblePages = computed(() => {
  const total = totalPages.value
  const cur = page.value
  const pages = []
  for (let i = Math.max(1, cur - 2); i <= Math.min(total, cur + 2); i++) pages.push(i)
  return pages
})

const primaryColumn = computed(() => props.columns.find(col => !col.rowIndex && col.key !== 'actions' && !col.hideMobile) || props.columns.find(col => !col.rowIndex && col.key !== 'actions'))
const secondaryColumn = computed(() => props.columns.find(col => !col.rowIndex && col.key !== 'actions' && col.key !== primaryColumn.value?.key && !['status', 'today_status', 'subscription_status'].includes(col.key)))
const statusColumn = computed(() => props.columns.find(col => ['status', 'today_status', 'subscription_status'].includes(col.key) && col.key !== primaryColumn.value?.key && col.key !== secondaryColumn.value?.key))
const previewColumns = computed(() => props.columns.filter(col => !col.rowIndex && col.key !== 'actions' && col.key !== primaryColumn.value?.key && col.key !== secondaryColumn.value?.key && col.key !== statusColumn.value?.key).slice(0, 2))
const expandedColumns = computed(() => props.columns.filter(col => !col.rowIndex && col.key !== 'actions' && col.key !== primaryColumn.value?.key && col.key !== secondaryColumn.value?.key && col.key !== statusColumn.value?.key))
const modalColumns = computed(() => props.columns.filter(col => !col.rowIndex && col.key !== 'actions'))
const mobileDetailsTitle = computed(() => {
  const value = selectedMobileRow.value && primaryColumn.value ? selectedMobileRow.value[primaryColumn.value.key] : ''
  return typeof value === 'string' && value.length ? value : 'Record details'
})
function rowKey(row, idx) { return String(row?.id ?? row?._id ?? `${page.value}-${idx}`) }
function humanizeValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return Array.isArray(value) ? value.join(', ') : 'View details'
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}
function toggleMobileDetails(row, idx) {
  const key = rowKey(row, idx)
  expandedRowKey.value = expandedRowKey.value === key ? null : key
}
function openMobileDetails(row, idx) {
  selectedMobileRow.value = row
  selectedMobileIndex.value = startRow.value + idx
  showMobileDetails.value = true
}
</script>

<style scoped>
.mobile-record-list { display: none; }
.mobile-record-modal-details { display: flex; flex-direction: column; gap: 0; }
.mobile-record-modal-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; padding: 12px 0; border-bottom: 1px solid var(--surface-border); font-size: 13px; }
.mobile-record-modal-row > span { color: var(--text-muted); flex: 0 0 37%; }
.mobile-record-modal-row > strong { text-align: right; min-width: 0; overflow-wrap: anywhere; font-weight: 600; }
.mobile-record-modal-actions { padding-top: 16px; }
.mobile-record-modal-actions__label { font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 10px; }
.mobile-record-modal-actions :deep(.row-actions) { display: flex; flex-wrap: wrap; gap: 8px; }
.mobile-record-modal-actions :deep(.icon-btn) { min-width: 40px; min-height: 40px; }
.mobile-record-modal-actions :deep(.action-cell) { white-space: normal; }
@media (max-width: 768px) {
  .table-scroll { display: none; }
  .mobile-record-list { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
  .mobile-filter-strip { display: flex; gap: 8px; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; padding: 1px 0 4px; margin: 0 -1px 2px; }
  .mobile-filter-strip::-webkit-scrollbar { display: none; }
  .mobile-filter-chip { flex: 0 0 auto; border: 1px solid var(--surface-border); border-radius: 999px; background: var(--bg); color: var(--text-secondary); padding: 8px 14px; font: 600 12px var(--font); white-space: nowrap; }
  .mobile-filter-chip.active { background: var(--primary); border-color: var(--primary); color: #fff; box-shadow: 0 4px 12px rgba(37,99,235,.22); }
  .mobile-record-card { background: var(--surface); border: 1px solid var(--surface-border); border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(15,23,42,.045); }
  .mobile-record-card__header { display: flex; flex-direction: column; align-items: stretch; gap: 5px; width: 100%; padding: 14px 15px 11px; border: 0; background: transparent; color: var(--text); text-align: left; }
  .mobile-record-card__topline { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:22px; }
  .mobile-record-card__status { font-size:12px; font-weight:600; min-width:0; }
  .mobile-record-card__chevron { color: var(--text-muted); display:inline-flex; align-items:center; }
  .mobile-record-card__title { width:100%; min-width:0; font-size:14px; font-weight:700; line-height:1.35; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .mobile-record-card__subtitle { width:100%; min-width:0; font-size:12px; line-height:1.35; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .mobile-record-card__preview { padding:0 15px 10px; display:grid; grid-template-columns:1fr 1fr; gap:8px 14px; }
  .mobile-record-card__preview-row { min-width:0; display:flex; flex-direction:column; gap:2px; }
  .mobile-record-card__preview-row > span, .mobile-record-card__detail-row > span { font-size:10px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
  .mobile-record-card__preview-row > strong { font-size:12px; color:var(--text); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .mobile-record-card__expanded { padding:8px 15px 10px; border-top:1px solid var(--surface-border); display:flex; flex-direction:column; }
  .mobile-record-card__detail-row { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; padding:8px 0; border-bottom:1px solid var(--surface-border); font-size:12px; }
  .mobile-record-card__detail-row:last-child { border-bottom:0; }
  .mobile-record-card__detail-row > strong { text-align:right; max-width:62%; overflow-wrap:anywhere; font-weight:600; }
  .mobile-record-card__actions { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:10px 15px 14px; border-top:1px solid var(--surface-border); }
  .mobile-record-card__actions .btn { width:100%; min-height:38px; justify-content:center; white-space:nowrap; }
  .mobile-record-loading { display:flex; justify-content:center; padding:36px; }
  .mobile-record-loading-placeholder { min-height:22px; }
  .initial-load-placeholder { min-height:22px; }
  .data-table-wrap { overflow:visible; }
  .table-toolbar { padding:12px 12px 0; border-bottom:0; }
  .table-search { max-width:none; width:100%; }
  .table-actions { width:100%; justify-content:flex-end; }
  .table-pagination { padding:12px; }
}
.initial-load-placeholder { min-height:22px; }
.data-table-wrap { border-radius: var(--radius); overflow: hidden; width: 100%; max-width: 100%; }
.table-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 16px 20px;
  border-bottom: 1px solid var(--surface-border);
  flex-wrap: wrap;
}
.table-search {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg); border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm); padding: 8px 12px;
  flex: 1; min-width: 180px; max-width: 320px;
}
.search-input {
  background: transparent; border: none; outline: none;
  font-size: 14px; color: var(--text); flex: 1;
}
.table-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

.table-scroll { 
  overflow-x: auto; 
  width: 100%; 
  -webkit-overflow-scrolling: touch;
}
table { 
  width: 100%; 
  border-collapse: collapse; 
  font-size: 14px; 
  table-layout: auto;
}
thead { background: linear-gradient(135deg, rgba(37,99,235,0.07), rgba(6,182,212,0.04)); }
th {
  padding: 13px 16px; text-align: left;
  font-weight: 600; font-size: 11px;
  text-transform: uppercase; letter-spacing: 0.07em;
  color: var(--text-secondary); white-space: nowrap;
  user-select: none;
}
th.sortable { cursor: pointer; }
th.sortable:hover { color: var(--primary); }
th.col-actions { white-space: nowrap; text-align: right; }
.th-inner { display: flex; align-items: center; gap: 6px; }
.sort-icon { opacity: 0.6; flex-shrink: 0; }
td {
  padding: 13px 16px; border-bottom: 1px solid var(--surface-border);
  vertical-align: middle;
}
.td-content {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: break-word;
  max-width: 100%;
  display: block;
}
td.col-actions {
  overflow: visible; 
  white-space: normal; 
  text-align: right;
}
.table-row:hover td { background: rgba(37,99,235,0.03); }
.table-row:last-child td { border-bottom: none; }

/* ── Loading state ─────────────────────────────────────────────── */
.loading-row td { border-bottom: none; }

.table-loading-cell {
  padding: 0 !important;
  border-bottom: none !important;
}

.table-loading-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  width: 100%;
  padding: 56px 20px;
}

.loading-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}

/* Elegant multi-ring spinner */
.spinner-ring {
  position: relative;
  width: 44px;
  height: 44px;
}
.spinner-ring div {
  box-sizing: border-box;
  display: block;
  position: absolute;
  width: 40px;
  height: 40px;
  margin: 2px;
  border: 3px solid transparent;
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spinner-ring 1.1s cubic-bezier(0.5, 0, 0.5, 1) infinite;
}
.spinner-ring div:nth-child(1) { animation-delay: -0.30s; border-top-color: var(--primary); }
.spinner-ring div:nth-child(2) { animation-delay: -0.20s; border-top-color: var(--accent);  opacity: 0.7; }
.spinner-ring div:nth-child(3) { animation-delay: -0.10s; border-top-color: var(--primary); opacity: 0.4; }
.spinner-ring div:nth-child(4) { animation-delay:    0s;  border-top-color: var(--accent);  opacity: 0.2; }

@keyframes spinner-ring {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.table-pagination {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-top: 1px solid var(--surface-border);
  flex-wrap: wrap; gap: 12px;
}
.pagination-info { font-size: 13px; color: var(--text-muted); }
.pagination-controls { display: flex; gap: 4px; align-items: center; }
.page-btn {
  min-width: 32px; height: 32px; padding: 0 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--surface-border);
  background: var(--surface); color: var(--text-secondary);
  font-size: 13px; cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  transition: all var(--transition);
}
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.page-btn:not(:disabled):not(.active):hover { border-color: var(--primary); color: var(--primary); }

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .hide-mobile { display: none; }
  .table-toolbar { padding: 12px 16px; gap: 8px; }
  .table-search { min-width: 0; max-width: 100%; flex: 1; }
  .table-actions { flex: 0 0 auto; }
  
  table { table-layout: fixed; width: 100%; }
  th, td { 
    padding: 12px 12px; 
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  
  .td-content {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
    display: block;
  }
  
  th.col-actions { 
    width: auto; 
    white-space: nowrap; 
    text-align: center; 
    padding-right: 12px;
  }
  td.col-actions { 
    overflow: visible; 
    white-space: nowrap; 
    text-align: center; 
    padding-right: 12px;
  }
  td.col-actions .td-content {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
  }

  .table-scroll {
    margin-right: 0;
    margin-left: 0;
  }

  .table-pagination {
    padding: 12px 16px;
    gap: 8px;
  }

  .pagination-info {
    font-size: 12px;
    flex: 1 0 100%;
  }

  .pagination-controls {
    flex: 1 0 auto;
    gap: 2px;
  }

  .page-btn {
    min-width: 28px;
    height: 28px;
    padding: 0 6px;
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .table-toolbar { 
    padding: 10px 12px; 
    gap: 6px;
  }
  
  th, td { 
    padding: 9px 10px;
    font-size: 12px;
  }

  th {
    font-size: 9px;
  }

  .td-content {
    max-width: 100%;
    font-size: 12px;
  }

  th.col-actions,
  td.col-actions {
    padding-right: 10px;
    text-align: center;
  }
  td.col-actions .td-content {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
  }

  .table-pagination {
    padding: 10px 12px;
    gap: 6px;
  }

  .pagination-info {
    font-size: 11px;
  }

  .page-btn {
    min-width: 24px;
    height: 24px;
    padding: 0 4px;
    font-size: 11px;
  }
}
</style>
