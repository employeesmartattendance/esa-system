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
        <thead>
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
        <tr v-if="loading" class="loading-row">
          <td :colspan="columns.length" class="table-loading-cell">
            <div class="table-loading-inner">
              <div class="spinner-ring">
                <div></div><div></div><div></div><div></div>
              </div>
              <span class="loading-text">Loading...</span>
            </div>
          </td>
        </tr>
          <tr v-else-if="!paginatedRows.length">
            <td :colspan="columns.length">
              <EmptyState :icon="emptyIcon || 'search'" :title="emptyTitle || 'No results'" :message="emptyMessage || ''" />
            </td>
          </tr>
          <template v-else>
            <tr v-for="row in paginatedRows" :key="row.id || row._id || Math.random()" class="table-row">
              <td
                v-for="col in columns"
                :key="col.key"
                :class="{ 'hide-mobile': col.hideMobile, 'col-actions': col.key === 'actions' }"
              >
                <div class="td-content" :title="row[col.key]">
                  <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                    {{ truncateText(row[col.key], col.truncateLength || 8) ?? '–' }}
                  </slot>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

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
import { ref, computed } from 'vue'
import AppIcon from './AppIcon.vue'
import EmptyState from './EmptyState.vue'

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

const searchQuery = ref('')
const sortKey = ref('')
const sortDir = ref('asc')
const page = ref(1)

function truncateText(text, maxLength = 8) {
  if (!text) return ''
  const str = String(text)
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str
}

function toggleSort(key) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = key; sortDir.value = 'asc' }
}

const filteredRows = computed(() => {
  let rows = Array.isArray(props.rows) ? [...props.rows] : []
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    rows = rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)))
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
</script>

<style scoped>
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
