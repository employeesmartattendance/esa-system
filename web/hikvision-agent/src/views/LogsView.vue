<template>
  <div class="view">
    <div class="view-header">
      <h2>Application Logs</h2>
      <div class="header-actions">
        <select v-model="category" class="input-sm">
          <option value="all">All Categories</option>
          <option value="INFO">Info</option>
          <option value="SUCCESS">Success</option>
          <option value="WARNING">Warning</option>
          <option value="ERROR">Error</option>
          <option value="DEVICE">Device</option>
          <option value="ESA">ESA</option>
          <option value="SYNC">Sync</option>
          <option value="SECURITY">Security</option>
        </select>
        <input v-model="search" type="text" class="input-sm" placeholder="Search logs..." style="flex:1; max-width:250px" />
        <button class="btn btn-sm btn-outline" @click="exportLogs">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <button class="btn btn-sm btn-danger" @click="clearLogs">Clear Logs</button>
      </div>
    </div>

    <!-- Auto-scroll toggle -->
    <div class="log-toolbar">
      <label class="toggle-label">
        <input type="checkbox" v-model="autoScroll" /> Auto-scroll to bottom
      </label>
      <span class="log-count">{{ filteredLogs.length }} entries</span>
    </div>

    <!-- Log output -->
    <div ref="logContainer" class="log-container">
      <div v-if="filteredLogs.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p>No logs recorded yet</p>
        <p class="hint">Application logs will appear here as the agent runs.</p>
      </div>
      <div
        v-for="(log, idx) in filteredLogs"
        :key="log.id || idx"
        class="log-line"
        :class="'log-' + log.category?.toLowerCase()"
      >
        <span class="log-time">{{ formatTime(log.timestamp) }}</span>
        <span class="log-cat" :class="'cat-' + (log.category || 'info').toLowerCase()">{{ log.category || 'INFO' }}</span>
        <span class="log-msg">{{ log.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';

const logs = ref([]);
const category = ref('all');
const search = ref('');
const autoScroll = ref(true);
const logContainer = ref(null);
let pollTimer = null;
let lastCount = 0;

const filteredLogs = computed(() => {
  let list = logs.value;
  if (category.value !== 'all') {
    list = list.filter(l => l.category === category.value);
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase();
    list = list.filter(l => l.message.toLowerCase().includes(q));
  }
  return list;
});

watch([filteredLogs, autoScroll], async () => {
  if (autoScroll.value && logContainer.value) {
    await nextTick();
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
});

async function loadLogs() {
  try {
    const result = await window.agentAPI.getLogs();
    if (Array.isArray(result)) {
      logs.value = result;
    }
  } catch (e) { /* ignore */ }
}

onMounted(() => {
  loadLogs();
  pollTimer = setInterval(() => {
    loadLogs();
  }, 2000);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});

async function clearLogs() {
  try {
    await window.agentAPI.clearLogs();
    logs.value = [];
  } catch (e) { /* ignore */ }
}

async function exportLogs() {
  try {
    const result = await window.agentAPI.exportLogs();
    if (result) {
      const blob = new Blob([result], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `esa-agent-logs-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    console.error('Export failed:', e);
  }
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
    '.' + String(d.getMilliseconds()).padStart(3, '0');
}
</script>

<style scoped>
.log-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 8px;
}
.toggle-label {
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
}
.toggle-label input {
  accent-color: var(--primary);
}
.log-count {
  font-size: 12px;
  color: var(--text-muted);
}
.log-container {
  background: #1a1a2e;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.7;
  max-height: calc(100vh - 260px);
  overflow-y: auto;
  color: #c9d1d9;
}
.log-line {
  display: flex;
  gap: 10px;
  padding: 1px 0;
  white-space: pre-wrap;
  word-break: break-all;
}
.log-time {
  color: #6e7681;
  flex-shrink: 0;
  user-select: none;
}
.log-cat {
  flex-shrink: 0;
  font-weight: 600;
  font-size: 11px;
  padding: 0 4px;
  border-radius: 3px;
  user-select: none;
}
.cat-info { color: #58a6ff; background: rgba(88,166,255,0.1); }
.cat-success { color: #3fb950; background: rgba(63,185,80,0.1); }
.cat-warning { color: #d29922; background: rgba(210,153,34,0.1); }
.cat-error { color: #f85149; background: rgba(248,81,73,0.1); }
.cat-device { color: #bc8cff; background: rgba(188,140,255,0.1); }
.cat-esa { color: #79c0ff; background: rgba(121,192,255,0.1); }
.cat-sync { color: #56d364; background: rgba(86,211,100,0.1); }
.cat-security { color: #ff7b72; background: rgba(255,123,114,0.1); }
.log-msg {
  flex: 1;
  min-width: 0;
}
.log-error .log-msg { color: #f85149; }
.log-warning .log-msg { color: #d29922; }
.input-sm {
  padding: 6px 10px;
  font-size: 13px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  outline: none;
}
.input-sm:focus { border-color: var(--primary); }
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
}
.empty-state p { margin-top: 12px; }
.empty-state .hint { font-size: 13px; margin-top: 4px; }
</style>
