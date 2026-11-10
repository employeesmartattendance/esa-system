<template>
  <div class="view">
    <div class="view-header">
      <h2>Settings</h2>
    </div>

    <div class="settings-sections">
      <!-- General -->
      <section class="settings-section">
        <h3>General</h3>
        <div class="form-group">
          <label>Agent Name</label>
          <input v-model="settings.agentName" type="text" class="input" placeholder="ESA Hikvision Agent" />
          <small class="form-hint">Displayed in the system tray and window title.</small>
        </div>
        <div class="form-group">
          <label>Minimize to Tray on Close</label>
          <label class="switch">
            <input type="checkbox" v-model="settings.minimizeToTray" />
            <span class="slider"></span>
          </label>
          <small class="form-hint">When enabled, closing the window hides the app to the system tray instead of quitting.</small>
        </div>
        <div class="form-group">
          <label>Start with Windows</label>
          <label class="switch">
            <input type="checkbox" v-model="settings.autoStart" />
            <span class="slider"></span>
          </label>
          <small class="form-hint">Launch the agent automatically when you log into Windows.</small>
        </div>
        <div class="form-group">
          <label>Start Minimized</label>
          <label class="switch">
            <input type="checkbox" v-model="settings.startMinimized" />
            <span class="slider"></span>
          </label>
          <small class="form-hint">Start the application minimized to the system tray.</small>
        </div>
      </section>

      <!-- Polling & Timing -->
      <section class="settings-section">
        <h3>Polling &amp; Timing</h3>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label>Command Poll Interval (ms)</label>
            <input v-model.number="settings.commandPollMs" type="number" class="input" min="1000" max="60000" step="500" />
            <small class="form-hint">How often to check ESA for new commands (1000–60000ms). Default: 4000</small>
          </div>
          <div class="form-group" style="flex:1">
            <label>Event Poll Interval (ms)</label>
            <input v-model.number="settings.eventPollMs" type="number" class="input" min="1000" max="60000" step="500" />
            <small class="form-hint">How often to check the device for fingerprint matches (1000–60000ms). Default: 4000</small>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label>Config Refresh Interval (ms)</label>
            <input v-model.number="settings.configRefreshMs" type="number" class="input" min="10000" max="300000" step="5000" />
            <small class="form-hint">How often to refresh device config from ESA (10000–300000ms). Default: 60000</small>
          </div>
          <div class="form-group" style="flex:1">
            <label>Fingerprint Capture Timeout (ms)</label>
            <input v-model.number="settings.captureTimeoutMs" type="number" class="input" min="30000" max="120000" step="5000" />
            <small class="form-hint">Max wait for fingerprint scan at device (30000–120000ms). Default: 75000</small>
          </div>
        </div>
      </section>

      <!-- Connection -->
      <section class="settings-section">
        <h3>Connection</h3>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label>Backend Request Timeout (ms)</label>
            <input v-model.number="settings.backendTimeoutMs" type="number" class="input" min="5000" max="60000" step="1000" />
            <small class="form-hint">Timeout for requests to the ESA backend. Default: 15000</small>
          </div>
          <div class="form-group" style="flex:1">
            <label>Device Request Timeout (ms)</label>
            <input v-model.number="settings.deviceTimeoutMs" type="number" class="input" min="3000" max="30000" step="1000" />
            <small class="form-hint">Timeout for ISAPI requests to the Hikvision device. Default: 8000</small>
          </div>
        </div>
        <div class="form-group">
          <label>Retry Backoff Base (ms)</label>
          <input v-model.number="settings.retryBaseMs" type="number" class="input" min="1000" max="30000" step="1000" />
          <small class="form-hint">Base delay before retrying a failed request. Default: 5000</small>
        </div>
        <div class="form-group">
          <label>Max Retries</label>
          <input v-model.number="settings.maxRetries" type="number" class="input" min="0" max="20" step="1" />
          <small class="form-hint">Maximum number of retry attempts for failed operations. Default: 3</small>
        </div>
      </section>

      <!-- Security -->
      <section class="settings-section">
        <h3>Security</h3>
        <div class="security-info">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--primary)" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <p>Credentials are stored securely using OS-level encryption. They are never logged or exposed in the UI. Agent authentication uses a bearer token that is never displayed after initial entry.</p>
        </div>
        <div class="form-group">
          <label>Log Sensitive Data</label>
          <label class="switch">
            <input type="checkbox" v-model="settings.logSensitiveData" />
            <span class="slider"></span>
          </label>
          <small class="form-hint danger">WARNING: Enabling this may expose passwords and tokens in log files. Only enable for debugging.</small>
        </div>
      </section>

      <!-- Actions -->
      <section class="settings-section">
        <div class="form-actions">
          <button class="btn btn-primary" @click="saveSettings" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Settings' }}
          </button>
          <button class="btn btn-outline" @click="resetDefaults">Reset to Defaults</button>
        </div>
        <div v-if="saveMessage" class="save-message" :class="saveOk ? 'success' : 'error'">{{ saveMessage }}</div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';

const saving = ref(false);
const saveMessage = ref('');
const saveOk = ref(false);

const defaults = {
  agentName: 'ESA Hikvision Agent',
  minimizeToTray: true,
  autoStart: false,
  startMinimized: false,
  commandPollMs: 4000,
  eventPollMs: 4000,
  configRefreshMs: 60000,
  captureTimeoutMs: 75000,
  backendTimeoutMs: 15000,
  deviceTimeoutMs: 8000,
  retryBaseMs: 5000,
  maxRetries: 3,
  logSensitiveData: false,
};

const settings = reactive({ ...defaults });

onMounted(async () => {
  try {
    const stored = await window.agentAPI.getSettings();
    if (stored && typeof stored === 'object') {
      Object.keys(defaults).forEach(key => {
        if (stored[key] !== undefined) settings[key] = stored[key];
      });
    }
  } catch (e) { /* use defaults */ }
});

async function saveSettings() {
  saving.value = true;
  saveMessage.value = '';
  try {
    // Validate ranges
    const errors = [];
    if (settings.commandPollMs < 1000 || settings.commandPollMs > 60000) errors.push('Command poll must be 1000-60000ms');
    if (settings.eventPollMs < 1000 || settings.eventPollMs > 60000) errors.push('Event poll must be 1000-60000ms');
    if (settings.configRefreshMs < 10000 || settings.configRefreshMs > 300000) errors.push('Config refresh must be 10000-300000ms');
    if (settings.captureTimeoutMs < 30000 || settings.captureTimeoutMs > 120000) errors.push('Capture timeout must be 30000-120000ms');

    if (errors.length) {
      saveOk.value = false;
      saveMessage.value = errors.join('. ');
      saving.value = false;
      return;
    }

    await window.agentAPI.setSettings({ ...settings });
    saveOk.value = true;
    saveMessage.value = 'Settings saved successfully.';
  } catch (e) {
    saveOk.value = false;
    saveMessage.value = 'Failed to save settings: ' + (e.message || 'Unknown error');
  }
  saving.value = false;
  setTimeout(() => { saveMessage.value = ''; }, 4000);
}

function resetDefaults() {
  Object.assign(settings, defaults);
}
</script>

<style scoped>
.settings-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 800px;
}
.settings-section {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
}
.settings-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.form-row {
  display: flex;
  gap: 16px;
}
.form-group {
  margin-bottom: 16px;
}
.form-group label:first-child {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.input {
  width: 100%;
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--input-bg);
  color: var(--text-primary);
  outline: none;
  box-sizing: border-box;
}
.input:focus { border-color: var(--primary); }
.form-hint {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}
.form-hint.danger { color: #dc2626; }
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  cursor: pointer;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  inset: 0;
  background: #ccc;
  border-radius: 24px;
  transition: 0.2s;
}
.slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.2s;
}
.switch input:checked + .slider { background: var(--primary); }
.switch input:checked + .slider::before { transform: translateX(20px); }
.security-info {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f0f7ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  margin-bottom: 16px;
  align-items: flex-start;
}
.security-info p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
}
.form-actions {
  display: flex;
  gap: 12px;
}
.save-message {
  margin-top: 12px;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 6px;
}
.save-message.success { background: #e6f9ee; color: #16a34a; }
.save-message.error { background: #fef2f2; color: #dc2626; }
</style>
