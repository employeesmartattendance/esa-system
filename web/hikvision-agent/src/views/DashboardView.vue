<template>
  <div class="dashboard-view">
    <div class="page-header">
      <h1>Dashboard</h1>
      <div class="header-actions">
        <button class="btn btn-success" v-if="!agentStatus.running" @click="startAgent" :disabled="loading">
          <span class="icon icon-sm" v-html="icons.play"></span>
          Start Agent
        </button>
        <button class="btn btn-danger" v-else @click="stopAgent" :disabled="loading">
          <span class="icon icon-sm" v-html="icons.stop"></span>
          Stop Agent
        </button>
      </div>
    </div>

    <!-- Status Cards -->
    <div class="status-grid">
      <div class="status-card">
        <div class="status-card-header">
          <span class="status-card-icon" style="color: var(--color-accent)">
            <span class="icon" v-html="icons.zap"></span>
          </span>
          <span class="badge" :class="agentStatus.running ? 'badge-success' : 'badge-error'">
            {{ agentStatus.running ? 'Running' : 'Stopped' }}
          </span>
        </div>
        <div class="status-card-body">
          <div class="status-card-label">Agent</div>
          <div class="status-card-value">{{ agentStatus.running ? 'Active' : 'Inactive' }}</div>
          <div class="status-card-detail" v-if="agentStatus.stats.uptimeStart">
            Uptime since {{ formatTime(agentStatus.stats.uptimeStart) }}
          </div>
        </div>
      </div>

      <div class="status-card">
        <div class="status-card-header">
          <span class="status-card-icon" style="color: var(--color-info)">
            <span class="icon" v-html="icons.cloud"></span>
          </span>
          <span class="status-dot" :class="agentStatus.esaStatus"></span>
        </div>
        <div class="status-card-body">
          <div class="status-card-label">ESA Backend</div>
          <div class="status-card-value">{{ capitalize(agentStatus.esaStatus) }}</div>
          <div class="status-card-detail" v-if="agentStatus.cachedDeviceHost">
            Device: {{ agentStatus.cachedDeviceHost }}
          </div>
        </div>
      </div>

      <div class="status-card">
        <div class="status-card-header">
          <span class="status-card-icon" style="color: var(--color-success)">
            <span class="icon" v-html="icons.device"></span>
          </span>
          <span class="status-dot" :class="agentStatus.deviceStatus"></span>
        </div>
        <div class="status-card-body">
          <div class="status-card-label">Device (ISAPI)</div>
          <div class="status-card-value">{{ capitalize(agentStatus.deviceStatus) }}</div>
          <div class="status-card-detail">Source: {{ agentStatus.deviceSource }}</div>
        </div>
      </div>

      <div class="status-card">
        <div class="status-card-header">
          <span class="status-card-icon" style="color: var(--color-warning)">
            <span class="icon" v-html="icons.activity"></span>
          </span>
        </div>
        <div class="status-card-body">
          <div class="status-card-label">Commands Processed</div>
          <div class="status-card-value">{{ agentStatus.stats.commandsProcessed }}</div>
          <div class="status-card-detail" v-if="agentStatus.stats.lastCommandAt">
            Last: {{ formatTime(agentStatus.stats.lastCommandAt) }}
          </div>
        </div>
      </div>

      <div class="status-card">
        <div class="status-card-header">
          <span class="status-card-icon" style="color: var(--color-success)">
            <span class="icon" v-html="icons.fingerprint"></span>
          </span>
        </div>
        <div class="status-card-body">
          <div class="status-card-label">Match Events Reported</div>
          <div class="status-card-value">{{ agentStatus.stats.eventsReported }}</div>
          <div class="status-card-detail" v-if="agentStatus.stats.lastEventAt">
            Last: {{ formatTime(agentStatus.stats.lastEventAt) }}
          </div>
        </div>
      </div>

      <div class="status-card">
        <div class="status-card-header">
          <span class="status-card-icon" style="color: var(--color-error)">
            <span class="icon" v-html="icons.alertTriangle"></span>
          </span>
        </div>
        <div class="status-card-body">
          <div class="status-card-label">Errors</div>
          <div class="status-card-value" :class="{ 'text-error': agentStatus.stats.errors > 0 }">
            {{ agentStatus.stats.errors }}
          </div>
          <div class="status-card-detail" v-if="agentStatus.stats.lastErrorAt">
            Last: {{ formatTime(agentStatus.stats.lastErrorAt) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Active Enrollments -->
    <div class="card" v-if="agentStatus.enrollments.length > 0">
      <div class="card-header">
        <h3>Active Enrollments</h3>
      </div>
      <div class="card-body" style="padding: 0;">
        <div class="enrollment-row" v-for="enr in agentStatus.enrollments" :key="enr.employeeNo">
          <div class="enrollment-info">
            <span class="enrollment-emp">Employee {{ enr.employeeNo }}</span>
            <span class="enrollment-finger">Finger #{{ enr.fingerNo }}</span>
          </div>
          <span class="badge" :class="enrollmentBadge(enr.status)">{{ enr.status }}</span>
        </div>
      </div>
    </div>

    <!-- Sync Queue -->
    <div class="card" v-if="agentStatus.syncQueue.pending > 0">
      <div class="card-header">
        <h3>Offline Sync Queue</h3>
        <span class="badge badge-warning">{{ agentStatus.syncQueue.pending }} pending</span>
      </div>
      <div class="card-body-compact">
        <p class="sync-note">Events queued while ESA was unreachable. They will sync automatically when connection is restored.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import icons from '../icons/index.js';
import { useAgent } from '../composables/useAgent.js';

const { agentStatus, loading, startAgent, stopAgent } = useAgent();

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Unknown';
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function enrollmentBadge(status) {
  if (status === 'enrolled') return 'badge-success';
  if (status === 'failed') return 'badge-error';
  if (status === 'capturing' || status === 'waiting_scan') return 'badge-info';
  return 'badge-warning';
}
</script>

<style scoped>
.dashboard-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.page-header h1 {
  font-size: 22px;
  font-weight: 700;
}
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}
.status-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--border-radius);
  padding: 16px 18px;
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-fast);
}
.status-card:hover {
  box-shadow: var(--shadow-md);
}
.status-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.status-card-icon .icon svg {
  width: 20px;
  height: 20px;
}
.status-card-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 2px;
}
.status-card-value {
  font-size: 20px;
  font-weight: 700;
}
.status-card-detail {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
}
.text-error {
  color: var(--color-error);
}
.enrollment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-bottom: 1px solid var(--color-border-light);
}
.enrollment-row:last-child {
  border-bottom: none;
}
.enrollment-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.enrollment-emp {
  font-weight: 600;
  font-size: 13px;
}
.enrollment-finger {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.sync-note {
  font-size: 13px;
  color: var(--color-text-secondary);
}
</style>