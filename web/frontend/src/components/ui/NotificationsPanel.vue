<template>
  <!-- Invisible overlay to catch outside-clicks -->
  <div v-if="modelValue" class="notif-backdrop" @click.self="$emit('update:modelValue', false)">
    <div class="notif-panel">
      <!-- Header -->
      <div class="np-head">
        <div class="np-head-left">
          <div class="np-bell-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
          </div>
          <span class="np-title">Notifications</span>
          <span v-if="items.length" class="np-count">{{ items.length }}</span>
        </div>
        <button class="np-close" @click="$emit('update:modelValue', false)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="np-loading">
        <div class="np-spinner"></div>
        <span>Loading…</span>
      </div>

      <!-- Empty -->
      <div v-else-if="!items.length" class="np-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        <p>No notifications yet</p>
      </div>

      <!-- Items -->
      <div v-else class="np-list">
        <div v-for="item in items" :key="item.id" class="np-item" :class="getType(item.action)">
          <div class="np-item-icon">
            <svg v-if="isLogin(item.action)"   width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <svg v-else-if="isDelete(item.action)" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            <svg v-else-if="isCreate(item.action)" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <svg v-else-if="isUpdate(item.action)" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <svg v-else-if="isCheck(item.action)"  width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>
          </div>
          <div class="np-item-body">
            <div class="np-item-action">{{ item.action }}</div>
            <div class="np-item-meta">
              <span>{{ item.user_name || 'System' }}</span>
              <span class="np-dot">·</span>
              <span>{{ timeAgo(item.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="np-footer">
        <button class="np-refresh-btn" @click="load">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ spinning: loading }">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          Refresh
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import api from '../../api'

const props = defineProps({ modelValue: { type: Boolean, default: false } })
const emit  = defineEmits(['update:modelValue'])

const items   = ref([])
const loading = ref(false)

// Auto-load when panel opens
watch(() => props.modelValue, (open) => { if (open) load() })

async function load() {
  loading.value = true
  try {
    const r   = await api.get('/notifications')
    items.value = Array.isArray(r) ? r : []
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

// Parse MySQL datetime "2026-03-17 10:00:00" as LOCAL time (not UTC)
function parseTs(ts) {
  if (!ts) return null
  const d = new Date(String(ts).replace(' ', 'T'))
  return isNaN(d.getTime()) ? null : d
}

function timeAgo(ts) {
  const d = parseTs(ts)
  if (!d) return ''
  const sec  = Math.floor((Date.now() - d.getTime()) / 1000)
  const min  = Math.floor(sec / 60)
  const hr   = Math.floor(min / 60)
  const day  = Math.floor(hr  / 24)
  if (sec < 60)  return 'just now'
  if (min < 60)  return `${min}m ago`
  if (hr  < 24)  return `${hr}h ago`
  if (day < 7)   return `${day}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Action classification helpers
const isLogin  = (a) => String(a).toLowerCase().includes('login')
const isDelete = (a) => String(a).toLowerCase().includes('delete')
const isCreate = (a) => String(a).toLowerCase().includes('create')
const isUpdate = (a) => String(a).toLowerCase().includes('update') || String(a).toLowerCase().includes('settings')
const isCheck  = (a) => String(a).toLowerCase().includes('check')

function getType(a) {
  if (isLogin(a))  return 'type-login'
  if (isDelete(a)) return 'type-delete'
  if (isCreate(a)) return 'type-create'
  if (isUpdate(a)) return 'type-update'
  if (isCheck(a))  return 'type-check'
  return 'type-default'
}
</script>

<style>
/* Non-scoped so fixed positioning works correctly */
.notif-backdrop {
  position: fixed;
  inset: 0;
  z-index: 8990;
  /* transparent — clicks on backdrop close panel */
}

.notif-panel {
  position: fixed;
  top: 68px;
  right: 16px;
  width: 340px;
  max-height: 480px;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(37, 99, 235, 0.06);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  overflow: hidden;
  z-index: 9000;
  animation: npSlideIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: all;
}

@keyframes npSlideIn {
  from { opacity: 0; transform: translateY(-8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}

/* Head */
.np-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--surface-border);
  flex-shrink: 0;
}
.np-head-left { display: flex; align-items: center; gap: 8px; }
.np-bell-icon {
  width: 30px; height: 30px;
  background: rgba(37, 99, 235, 0.1);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.np-title { font-size: 14px; font-weight: 700; }
.np-count {
  background: var(--primary); color: #fff;
  font-size: 11px; font-weight: 700;
  padding: 1px 7px; border-radius: 99px;
}
.np-close {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: 1px solid var(--surface-border);
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.np-close:hover { background: var(--danger); color: #fff; border-color: var(--danger); }

/* Loading */
.np-loading {
  display: flex; align-items: center; justify-content: center;
  gap: 10px; padding: 32px;
  color: var(--text-muted); font-size: 13px;
}
.np-spinner {
  width: 16px; height: 16px;
  border: 2px solid var(--surface-border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: npSpin 0.75s linear infinite;
}

/* Empty */
.np-empty {
  text-align: center; padding: 36px 20px;
  color: var(--text-muted);
}
.np-empty p { font-size: 13px; margin-top: 10px; }

/* List */
.np-list { flex: 1; overflow-y: auto; }

.np-item {
  display: flex; align-items: flex-start;
  gap: 10px; padding: 12px 16px;
  border-bottom: 1px solid var(--surface-border);
  transition: background 0.15s;
  cursor: default;
}
.np-item:last-child { border-bottom: none; }
.np-item:hover { background: rgba(37, 99, 235, 0.04); }

/* Item icon */
.np-item-icon {
  width: 28px; height: 28px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; margin-top: 1px;
}
.type-login   .np-item-icon { background: rgba(37,99,235,0.12);  color: var(--primary); }
.type-delete  .np-item-icon { background: rgba(239,68,68,0.12);  color: var(--danger);  }
.type-create  .np-item-icon { background: rgba(16,185,129,0.12); color: var(--success); }
.type-update  .np-item-icon { background: rgba(245,158,11,0.12); color: var(--warning); }
.type-check   .np-item-icon { background: rgba(16,185,129,0.12); color: var(--success); }
.type-default .np-item-icon { background: rgba(139,92,246,0.12); color: var(--info);    }

/* Item body */
.np-item-action { font-size: 13px; font-weight: 600; line-height: 1.3; }
.np-item-meta   {
  font-size: 11px; color: var(--text-muted);
  margin-top: 3px;
  display: flex; align-items: center; gap: 4px;
}
.np-dot { opacity: 0.35; }

/* Footer */
.np-footer {
  padding: 10px 12px;
  border-top: 1px solid var(--surface-border);
  flex-shrink: 0;
}
.np-refresh-btn {
  width: 100%; display: flex; align-items: center; justify-content: center;
  gap: 7px; padding: 8px;
  background: transparent;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 13px; font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  font-family: var(--font);
}
.np-refresh-btn:hover { border-color: var(--primary); color: var(--primary); background: rgba(37,99,235,0.05); }

/* Animations */
@keyframes npSpin    { to { transform: rotate(360deg); } }
.spinning { animation: npSpin 0.8s linear infinite; }

@media (max-width: 400px) {
  .notif-panel { width: calc(100vw - 20px); right: 10px; }
}
</style>
