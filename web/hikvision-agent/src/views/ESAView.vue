<template>
  <div class="esa-view">
    <div class="page-header">
      <h1>ESA Backend</h1>
      <button class="btn" @click="testEsa" :disabled="esaTesting">
        <span class="spinner" v-if="esaTesting"></span>
        <span v-else>Test Connection</span>
      </button>
    </div>

    <!-- Connection Status Card -->
    <div class="card">
      <div class="card-header">
        <h3>Connection Status</h3>
        <span class="badge" :class="esaStatusBadge">{{ esaStatusLabel }}</span>
      </div>
      <div class="card-body">
        <div class="esa-status-grid">
          <div class="status-item">
            <span class="status-label">Status</span>
            <span class="status-value" :style="{ color: esaStatusColor }">
              <span class="status-dot" :class="esa.status.esaStatus"></span>
              {{ esaStatusLabel }}
            </span>
          </div>
          <div class="status-item">
            <span class="status-label">Backend URL</span>
            <span class="status-value mono">{{ esa.status.backendUrl || 'Not configured' }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Agent Token</span>
            <span class="status-value">{{ esa.status.configured ? '••••••••' + (token.length > 8 ? token.slice(-4) : '') : 'Not set' }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Device Source</span>
            <span class="status-value">{{ agentStatus.deviceSource }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Configuration Card -->
    <div class="card">
      <div class="card-header">
        <h3>Backend Configuration</h3>
      </div>
      <div class="card-body">
        <div class="esa-form">
          <div class="input-group">
            <label>Backend URL</label>
            <input class="input-field" v-model="form.backendUrl" placeholder="https://esa-system.onrender.com" />
          </div>
          <div class="input-group">
            <label>Agent Token</label>
            <input class="input-field" type="password" v-model="form.agentToken" placeholder="Paste your agent token" />
          </div>
          <div class="form-actions">
            <button class="btn btn-primary" @click="saveEsa">Save Configuration</button>
            <button class="btn" @click="testEsa">Test Connection</button>
          </div>
          <p v-if="testResult" class="test-result" :class="testResult.ok ? 'success' : 'error'">
            {{ testResult.message }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import icons from '../icons/index.js';
import { useAgent } from '../composables/useAgent.js';

const { agentStatus } = useAgent();

const esa = reactive({ status: { configured: false, backendUrl: '', connected: false, esaStatus: 'disconnected' } });
const form = reactive({ backendUrl: '', agentToken: '' });
const token = ref('');
const esaTesting = ref(false);
const testResult = ref(null);

const esaStatusLabel = computed(() => {
  const s = esa.status.esaStatus;
  if (s === 'connected') return 'Connected';
  if (s === 'configured') return 'Configured (Agent Stopped)';
  if (s === 'error') return 'Error';
  return 'Disconnected';
});

const esaStatusBadge = computed(() => {
  const s = esa.status.esaStatus;
  if (s === 'connected') return 'badge-success';
  if (s === 'error') return 'badge-error';
  if (s === 'configured') return 'badge-warning';
  return 'badge-info';
});

const esaStatusColor = computed(() => {
  const s = esa.status.esaStatus;
  if (s === 'connected') return 'var(--color-success)';
  if (s === 'error') return 'var(--color-error)';
  return 'var(--color-text-tertiary)';
});

onMounted(async () => {
  try {
    const config = await window.agentAPI.config.get();
    if (config.esa) {
      form.backendUrl = config.esa.backendUrl || '';
      form.agentToken = config.esa.agentToken || '';
      token.value = config.esa.agentToken || '';
    }
    esa.status = await window.agentAPI.esa.getStatus();
  } catch {}
});

async function saveEsa() {
  await window.agentAPI.esa.register({ backendUrl: form.backendUrl, agentToken: form.agentToken });
  token.value = form.agentToken;
  esa.status = await window.agentAPI.esa.getStatus();
  testResult.value = null;
}

async function testEsa() {
  if (form.backendUrl && form.agentToken) {
    await saveEsa();
  }
  esaTesting.value = true;
  testResult.value = null;
  try {
    const result = await window.agentAPI.esa.test();
    testResult.value = result;
    esa.status = await window.agentAPI.esa.getStatus();
  } catch (err) {
    testResult.value = { ok: false, message: err.message };
  } finally {
    esaTesting.value = false;
  }
}
</script>

<style scoped>
.esa-view {
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
.esa-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
.status-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.status-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.status-value {
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}
.mono {
  font-family: var(--font-mono);
  font-size: 12px;
  word-break: break-all;
}
.esa-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 480px;
}
.form-actions {
  display: flex;
  gap: 10px;
}
.test-result {
  font-size: 13px;
  font-weight: 500;
}
.test-result.success { color: var(--color-success); }
.test-result.error { color: var(--color-error); }
</style>