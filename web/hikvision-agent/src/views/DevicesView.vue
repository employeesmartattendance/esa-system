<template>
  <div class="devices-view">
    <div class="page-header">
      <h1>Devices</h1>
      <button class="btn btn-primary" @click="showAddForm = !showAddForm">
        <span class="icon icon-sm" v-html="icons.plus"></span>
        {{ showAddForm ? 'Cancel' : 'Add Device' }}
      </button>
    </div>

    <!-- Add/Edit Device Form -->
    <div class="card" v-if="showAddForm" style="margin-bottom: 20px;">
      <div class="card-header">
        <h3>Device Configuration</h3>
      </div>
      <div class="card-body">
        <div class="device-form">
          <div class="form-row">
            <div class="input-group">
              <label>IP Address / Hostname</label>
              <input class="input-field" v-model="form.host" placeholder="192.168.1.64" />
            </div>
            <div class="input-group" style="max-width: 120px;">
              <label>Port</label>
              <input class="input-field" v-model.number="form.port" type="number" placeholder="80" />
            </div>
          </div>
          <div class="form-row">
            <div class="input-group">
              <label>Username</label>
              <input class="input-field" v-model="form.username" placeholder="admin" />
            </div>
            <div class="input-group">
              <label>Password</label>
              <input class="input-field" type="password" v-model="form.password" placeholder="Device password" />
            </div>
          </div>
          <div class="form-actions">
            <button class="btn" @click="testConnection" :disabled="testing">
              <span class="spinner" v-if="testing"></span>
              <span v-else>Test Connection</span>
            </button>
            <button class="btn btn-primary" @click="saveDevice" :disabled="testing">Save</button>
          </div>
          <p v-if="testResult" class="test-result" :class="testResult.ok ? 'success' : 'error'">
            {{ testResult.ok ? '✓' : '✗' }} {{ testResult.message }}
            <template v-if="testResult.ok && testResult.model">
              — {{ testResult.deviceName }} ({{ testResult.model }})
            </template>
          </p>
        </div>
      </div>
    </div>

    <!-- Device List -->
    <div class="card">
      <div class="card-header">
        <h3>Configured Devices</h3>
      </div>
      <div class="card-body" style="padding: 0;">
        <div v-if="deviceConfig.host" class="device-item">
          <div class="device-item-info">
            <span class="icon icon-lg" style="color: var(--color-text-secondary)" v-html="icons.device"></span>
            <div>
              <div class="device-item-name">{{ deviceConfig.host }}:{{ deviceConfig.port }}</div>
              <div class="device-item-detail">
                Source: {{ deviceConfig.source }} | User: {{ deviceConfig.username }}
                <span v-if="agentStatus.deviceStatus === 'connected'"> | <span class="status-dot connected"></span> Connected</span>
              </div>
            </div>
          </div>
          <div class="device-item-actions">
            <button class="btn btn-sm" @click="showAddForm = true; loadForm()">Edit</button>
            <button class="btn btn-sm" @click="testExistingConnection">
              <span class="spinner" v-if="testingExisting"></span>
              <span v-else>Test</span>
            </button>
          </div>
        </div>
        <div v-else class="empty-state">
          <span class="icon icon-xl" v-html="icons.device"></span>
          <p>No device configured yet. Click "Add Device" to get started.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import icons from '../icons/index.js';
import { useAgent } from '../composables/useAgent.js';

const { agentStatus } = useAgent();

const showAddForm = ref(false);
const testing = ref(false);
const testingExisting = ref(false);
const testResult = ref(null);
const deviceConfig = reactive({ host: '', port: 80, username: 'admin', password: '', source: 'manual' });
const form = reactive({ host: '', port: 80, username: 'admin', password: '' });

onMounted(async () => {
  try {
    const config = await window.agentAPI.config.get();
    if (config.device) Object.assign(deviceConfig, config.device);
  } catch {}
});

function loadForm() {
  form.host = deviceConfig.host;
  form.port = deviceConfig.port;
  form.username = deviceConfig.username;
  form.password = deviceConfig.password;
  testResult.value = null;
}

async function testConnection() {
  testing.value = true;
  testResult.value = null;
  try {
    const result = await window.agentAPI.device.testConnection({ host: form.host, port: form.port, username: form.username, password: form.password });
    testResult.value = result;
  } catch (err) {
    testResult.value = { ok: false, message: err.message };
  } finally {
    testing.value = false;
  }
}

async function testExistingConnection() {
  testingExisting.value = true;
  try {
    await window.agentAPI.device.testConnection();
  } catch {} finally {
    testingExisting.value = false;
  }
}

async function saveDevice() {
  await window.agentAPI.settings.set({
    device: { host: form.host, port: form.port, username: form.username, password: form.password, source: 'manual' },
  });
  Object.assign(deviceConfig, { host: form.host, port: form.port, username: form.username, password: form.password, source: 'manual' });
  showAddForm.value = false;
}
</script>

<style scoped>
.devices-view {
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
.device-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.form-row {
  display: flex;
  gap: 12px;
}
.form-row .input-group {
  flex: 1;
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
.device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border-light);
}
.device-item:last-child { border-bottom: none; }
.device-item-info {
  display: flex;
  align-items: center;
  gap: 14px;
}
.device-item-name {
  font-weight: 600;
  font-size: 14px;
}
.device-item-detail {
  font-size: 12px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}
.device-item-actions {
  display: flex;
  gap: 8px;
}
</style>