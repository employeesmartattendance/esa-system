<template>
  <div class="setup-view">
    <div class="setup-container">
      <div class="setup-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: ((step + 1) / totalSteps * 100) + '%' }"></div>
        </div>
        <div class="step-labels">
          <span v-for="(s, i) in stepNames" :key="i" class="step-label" :class="{ active: i === step, done: i < step }">
            {{ s }}
          </span>
        </div>
      </div>

      <div class="setup-card card">
        <!-- Step 0: Welcome -->
        <div v-if="step === 0" class="setup-step">
          <div class="step-icon-wrap" style="color: var(--color-accent)">
            <span class="icon icon-xl" v-html="icons.setup"></span>
          </div>
          <h2>Welcome to ESA Hikvision Agent</h2>
          <p class="step-desc">This wizard will help you connect your Hikvision fingerprint terminal to the ESA cloud backend. You will need:</p>
          <ul class="step-list">
            <li>Your ESA backend URL (e.g., https://esa-system.onrender.com)</li>
            <li>Your agent token from ESA Settings</li>
            <li>Your Hikvision device IP address and credentials</li>
          </ul>
          <button class="btn btn-primary btn-lg" @click="step = 1">Get Started</button>
        </div>

        <!-- Step 1: ESA Backend -->
        <div v-if="step === 1" class="setup-step">
          <h2>Connect to ESA Backend</h2>
          <p class="step-desc">Enter your ESA backend URL and agent token.</p>
          <div class="setup-form">
            <div class="input-group">
              <label>Backend URL</label>
              <input class="input-field" v-model="esa.backendUrl" placeholder="https://esa-system.onrender.com" />
            </div>
            <div class="input-group">
              <label>Agent Token</label>
              <input class="input-field" type="password" v-model="esa.agentToken" placeholder="Paste your agent token here" />
            </div>
          </div>
          <div class="setup-actions">
            <button class="btn" @click="step = 0">
              <span class="icon icon-sm" v-html="icons.chevronLeft"></span> Back
            </button>
            <button class="btn btn-primary" @click="testEsa" :disabled="esaTesting">
              <span class="spinner" v-if="esaTesting"></span>
              <span v-else>Test &amp; Continue</span>
            </button>
          </div>
          <p v-if="esaError" class="setup-error">{{ esaError }}</p>
          <p v-if="esaSuccess" class="setup-success">Connected to ESA backend successfully.</p>
        </div>

        <!-- Step 2: Device Network -->
        <div v-if="step === 2" class="setup-step">
          <h2>Configure Device</h2>
          <p class="step-desc">Enter your Hikvision device's IP address and login credentials.</p>
          <div class="setup-form">
            <div class="input-group">
              <label>Device IP Address</label>
              <input class="input-field" v-model="device.host" placeholder="192.168.1.64" />
            </div>
            <div class="input-group">
              <label>HTTP Port</label>
              <input class="input-field" v-model.number="device.port" placeholder="80" type="number" />
            </div>
            <div class="input-field-row">
              <div class="input-group">
                <label>Username</label>
                <input class="input-field" v-model="device.username" placeholder="admin" />
              </div>
              <div class="input-group">
                <label>Password</label>
                <input class="input-field" type="password" v-model="device.password" placeholder="Device password" />
              </div>
            </div>
          </div>
          <div class="setup-actions">
            <button class="btn" @click="step = 1">
              <span class="icon icon-sm" v-html="icons.chevronLeft"></span> Back
            </button>
            <button class="btn btn-primary" @click="testDevice" :disabled="deviceTesting">
              <span class="spinner" v-if="deviceTesting"></span>
              <span v-else>Test Connection</span>
            </button>
          </div>
          <p v-if="deviceError" class="setup-error">{{ deviceError }}</p>
          <p v-if="deviceInfo" class="setup-success">
            Connected: {{ deviceInfo.deviceName || 'Device' }} ({{ deviceInfo.model || '' }})
          </p>
        </div>

        <!-- Step 3: Complete -->
        <div v-if="step === 3" class="setup-step">
          <div class="step-icon-wrap" style="color: var(--color-success)">
            <span class="icon icon-xl" v-html="icons.check"></span>
          </div>
          <h2>Setup Complete</h2>
          <p class="step-desc">Your ESA Hikvision Agent is configured and ready to use. Start the agent to begin polling for commands and match events.</p>
          <div class="setup-actions" style="justify-content: center;">
            <button class="btn btn-primary btn-lg" @click="goToDashboard">Go to Dashboard</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import icons from '../icons/index.js';

const router = useRouter();
const step = ref(0);
const totalSteps = 4;
const stepNames = ['Welcome', 'ESA', 'Device', 'Done'];

const esa = reactive({ backendUrl: '', agentToken: '' });
const device = reactive({ host: '', port: 80, username: 'admin', password: '' });

const esaTesting = ref(false);
const esaError = ref('');
const esaSuccess = ref(false);
const deviceTesting = ref(false);
const deviceError = ref('');
const deviceInfo = ref(null);

async function loadExisting() {
  try {
    const config = await window.agentAPI.config.get();
    if (config.esa) {
      esa.backendUrl = config.esa.backendUrl || '';
      esa.agentToken = config.esa.agentToken || '';
    }
    if (config.device) {
      device.host = config.device.host || '';
      device.port = config.device.port || 80;
      device.username = config.device.username || 'admin';
      device.password = config.device.password || '';
    }
    if (config.setupCompleted) {
      step.value = 3;
    }
  } catch {}
}
loadExisting();

async function testEsa() {
  esaTesting.value = true;
  esaError.value = '';
  esaSuccess.value = false;
  try {
    await window.agentAPI.esa.register({ backendUrl: esa.backendUrl, agentToken: esa.agentToken });
    const result = await window.agentAPI.esa.test();
    if (result.ok) {
      esaSuccess.value = true;
      setTimeout(() => { step.value = 2; }, 600);
    } else {
      esaError.value = result.message || 'Connection failed';
    }
  } catch (err) {
    esaError.value = err.message || 'Could not connect';
  } finally {
    esaTesting.value = false;
  }
}

async function testDevice() {
  deviceTesting.value = true;
  deviceError.value = '';
  deviceInfo.value = null;
  try {
    await window.agentAPI.device.setNetwork({ host: device.host, port: device.port });
    // Set credentials
    await window.agentAPI.config.set({
      device: { ...device },
      device_source: 'manual',
    });
    // Need to also save username/password
    await window.agentAPI.settings.set({
      device: { host: device.host, port: device.port, username: device.username, password: device.password, source: 'manual' },
    });
    const result = await window.agentAPI.device.testConnection();
    if (result.ok) {
      deviceInfo.value = result;
      await window.agentAPI.config.set({ setupCompleted: true });
      setTimeout(() => { step.value = 3; }, 600);
    } else {
      deviceError.value = result.message || 'Connection failed';
    }
  } catch (err) {
    deviceError.value = err.message || 'Could not connect';
  } finally {
    deviceTesting.value = false;
  }
}

function goToDashboard() {
  router.push('/dashboard');
}
</script>

<style scoped>
.setup-view {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 20px;
}
.setup-container {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.setup-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.progress-bar {
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 0.4s ease;
}
.step-labels {
  display: flex;
  justify-content: space-between;
}
.step-label {
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: 500;
}
.step-label.active {
  color: var(--color-accent);
  font-weight: 600;
}
.step-label.done {
  color: var(--color-success);
}
.setup-card {
  padding: 32px;
}
.setup-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
}
.setup-step h2 {
  font-size: 20px;
  font-weight: 700;
}
.step-desc {
  color: var(--color-text-secondary);
  font-size: 13px;
  max-width: 400px;
}
.step-icon-wrap {
  margin-bottom: 4px;
}
.step-list {
  text-align: left;
  padding-left: 20px;
  font-size: 13px;
  color: var(--color-text-secondary);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.step-list li {
  line-height: 1.6;
}
.setup-form {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 8px;
  align-self: center;
}
.setup-actions {
  display: flex;
  justify-content: space-between;
  width: 100%;
  max-width: 360px;
  margin-top: 16px;
  align-self: center;
}
.setup-error {
  color: var(--color-error);
  font-size: 13px;
  font-weight: 500;
}
.setup-success {
  color: var(--color-success);
  font-size: 13px;
  font-weight: 500;
}
</style>