<template>
  <div class="view">
    <div class="view-header">
      <h2>Events</h2>
      <div class="header-actions">
        <button class="btn btn-sm btn-outline" @click="refreshEvents">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
          Refresh
        </button>
        <button class="btn btn-sm btn-outline" @click="clearAll">Clear All</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-value">{{ matchEvents.length }}</span>
        <span class="stat-label">Fingerprint Matches</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ commandEvents.length }}</span>
        <span class="stat-label">Commands Processed</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ errorEvents.length }}</span>
        <span class="stat-label">Errors</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ allEvents.length }}</span>
        <span class="stat-label">Total Events</span>
      </div>
    </div>

    <!-- Filter -->
    <div class="filter-bar">
      <select v-model="filter" class="input-sm">
        <option value="all">All Events</option>
        <option value="match">Fingerprint Matches</option>
        <option value="command">Commands</option>
        <option value="error">Errors</option>
        <option value="sync">Sync</option>
      </select>
      <input v-model="search" type="text" class="input-sm" placeholder="Search events..." style="flex:1; max-width:300px" />
    </div>

    <!-- Event list -->
    <div class="event-list">
      <div v-if="filteredEvents.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        <p>No events recorded yet</p>
        <p class="hint">Events will appear here as the agent processes commands and detects fingerprint matches.</p>
      </div>
      <div v-for="ev in filteredEvents" :key="ev.id" class="event-item" :class="'event-' + ev.type">
        <div class="event-icon">
          <svg v-if="ev.type === 'match'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/></svg>
          <svg v-else-if="ev.type === 'command'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          <svg v-else-if="ev.type === 'error'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </div>
        <div class="event-body">
          <div class="event-message">{{ ev.message }}</div>
          <div class="event-meta">
            <span class="event-type-badge">{{ ev.type }}</span>
            <span class="event-time">{{ formatTime(ev.timestamp) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAgent } from '../composables/useAgent';

const { status } = useAgent();

const filter = ref('all');
const search = ref('');
const allEvents = ref([]);

const matchEvents = computed(() => allEvents.value.filter(e => e.type === 'match'));
const commandEvents = computed(() => allEvents.value.filter(e => e.type === 'command'));
const errorEvents = computed(() => allEvents.value.filter(e => e.type === 'error'));

const filteredEvents = computed(() => {
  let list = allEvents.value;
  if (filter.value !== 'all') {
    list = list.filter(e => e.type === filter.value);
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase();
    list = list.filter(e => e.message.toLowerCase().includes(q));
  }
  return list.slice(0, 200);
});

let listener = null;

onMounted(async () => {
  try {
    const events = await window.agentAPI.getEvents();
    if (Array.isArray(events)) allEvents.value = events;
  } catch (e) { /* ignore */ }
  listener = (ev) => {
    if (ev && ev.type && ev.message) {
      allEvents.value.unshift(ev);
      if (allEvents.value.length > 1000) allEvents.value = allEvents.value.slice(0, 1000);
    }
  };
  window.agentAPI.onStatusChange(listener);
});

onUnmounted(() => {
  if (listener) window.agentAPI.removeStatusListener(listener);
});

async function refreshEvents() {
  try {
    const events = await window.agentAPI.getEvents();
    if (Array.isArray(events)) allEvents.value = events;
  } catch (e) { /* ignore */ }
}

async function clearAll() {
  try {
    await window.agentAPI.clearEvents();
    allEvents.value = [];
  } catch (e) { /* ignore */ }
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString();
}
</script>

<style scoped>
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}
.stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}
.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
  display: block;
}
.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: center;
}
.event-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.event-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--card-bg);
  border: 1px solid var(--border);
}
.event-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}
.event-match .event-icon { background: #e6f9ee; color: #16a34a; }
.event-command .event-icon { background: #e8f0fe; color: #2563eb; }
.event-error .event-icon { background: #fef2f2; color: #dc2626; }
.event-sync .event-icon { background: #fefce8; color: #ca8a04; }
.event-body {
  flex: 1;
  min-width: 0;
}
.event-message {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.4;
  word-break: break-word;
}
.event-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.event-type-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  font-weight: 600;
}
.event-match .event-type-badge { background: #e6f9ee; color: #16a34a; }
.event-command .event-type-badge { background: #e8f0fe; color: #2563eb; }
.event-error .event-type-badge { background: #fef2f2; color: #dc2626; }
.event-sync .event-type-badge { background: #fefce8; color: #ca8a04; }
.event-time {
  font-size: 11px;
  color: var(--text-muted);
}
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
}
.empty-state p { margin-top: 12px; }
.empty-state .hint { font-size: 13px; margin-top: 4px; }
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
</style>
