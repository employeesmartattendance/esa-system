<template>
  <div class="glass settings-card fdc">
    <div class="card-head">
      <div class="card-icon-wrap" style="background:rgba(139,92,246,0.12)">
        <AppIcon name="shield" :size="20" color="#8b5cf6" />
      </div>
      <div class="card-head-text">
        <div class="card-title">Fingerprint Device (Hikvision)</div>
        <div class="card-desc">Connect a physical Hikvision fingerprint terminal for check-in/out</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" v-model="form.enabled" />
        <span class="toggle-track"></span>
      </label>
    </div>

    <div class="card-body" :class="{ 'card-disabled': !form.enabled }">
      <div class="info-box">
        <AppIcon name="info" :size="13" color="var(--primary)" />
        <span>Enter the device's IP address and ISAPI login (set on the device itself under Network / User settings). Employees then enroll their fingerprint directly on the device, and simply scan a finger there to check in or out.</span>
      </div>

      <div class="fdc-notice-important">
        <AppIcon name="alert-triangle" :size="14" color="var(--warning)" />
        <span>Since ESA's backend runs in the cloud, it can't reach a device on your local network directly. You'll need to run a small bridge agent on any always-on computer on the <strong>same network as the device</strong> — it's in the <code>hikvision-agent</code> folder of your project. Save your device below first to get the agent token it needs.</span>
      </div>

      <div class="fdc-grid">
        <div class="form-group">
          <label class="form-label">Device IP / Host</label>
          <input v-model="form.host" type="text" class="form-input mono-font" placeholder="192.168.1.50" />
        </div>
        <div class="form-group">
          <label class="form-label">Port</label>
          <input v-model="form.port" type="number" class="form-input mono-font" placeholder="80" />
        </div>
        <div class="form-group">
          <label class="form-label">ISAPI Username</label>
          <input v-model="form.username" type="text" class="form-input" placeholder="admin" autocomplete="off" />
        </div>
        <div class="form-group">
          <label class="form-label">ISAPI Password</label>
          <input v-model="form.password" type="password" class="form-input" :placeholder="hasPassword ? '•••••••• (leave blank to keep current)' : 'Device password'" autocomplete="new-password" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Device Label (optional)</label>
        <input v-model="form.device_name" type="text" class="form-input" placeholder="Main Entrance Terminal" />
      </div>

      <div class="fdc-actions">
        <button class="btn btn-primary" @click="save" :disabled="saving || !form.host || !form.username">
          <span v-if="saving" class="bsc-spinner-sm"></span>
          {{ saving ? 'Saving…' : 'Save Device' }}
        </button>
        <button class="btn btn-secondary" @click="regenerateToken" :disabled="regenerating || !deviceId">
          <span v-if="regenerating" class="bsc-spinner-sm"></span>
          <AppIcon v-else name="refresh" :size="14" />
          {{ regenerating ? 'Generating…' : (hasAgentToken ? 'Regenerate Agent Token' : 'Generate Agent Token') }}
        </button>
      </div>

      <div v-if="newAgentToken" class="fdc-token-box">
        <div class="fdc-token-label">
          <AppIcon name="shield" :size="13" color="var(--warning)" />
          Agent token — copy this now, it won't be shown again
        </div>
        <div class="fdc-token-value">
          <code>{{ newAgentToken }}</code>
          <button class="fdc-copy-btn" @click="copyToken">{{ copied ? 'Copied!' : 'Copy' }}</button>
        </div>
        <p class="fdc-token-hint">Paste this as <code>agentToken</code> in <code>hikvision-agent/config.js</code> on the computer running the bridge agent, along with <code>backendUrl</code> set to this app's backend URL.</p>
      </div>

      <div v-if="statusMsg" class="bsc-notice" :class="statusOk ? 'fdc-notice-ok' : 'bsc-notice-error'">
        <AppIcon :name="statusOk ? 'user-check' : 'alert-triangle'" :size="14" :color="statusOk ? 'var(--success)' : 'var(--danger)'" />
        <span>{{ statusMsg }}</span>
      </div>

      <div v-if="deviceId" class="fdc-meta">
        <div>Bridge agent: <strong :style="{ color: agentOnline ? 'var(--success)' : 'var(--text-muted)' }">{{ agentOnline ? 'Online' : (hasAgentToken ? 'Not connected yet' : 'Not set up') }}</strong><span v-if="lastAgentSeenAt"> · last seen {{ fmtDate(lastAgentSeenAt) }}</span></div>
        <div v-if="lastPollAt">Last device check: {{ fmtDate(lastPollAt) }}<span v-if="lastPollError" class="fdc-meta-error"> — {{ lastPollError }}</span></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppIcon from './AppIcon.vue'
import { useToast } from '../../composables/useToast'
import api from '../../api'

const toast = useToast()

const form = ref({ host: '', port: 80, username: '', password: '', device_name: '', enabled: true })
const deviceId = ref(null)
const hasPassword = ref(false)
const hasAgentToken = ref(false)
const agentOnline = ref(false)
const lastAgentSeenAt = ref(null)
const newAgentToken = ref('')
const copied = ref(false)
const saving = ref(false)
const regenerating = ref(false)
const statusMsg = ref('')
const statusOk = ref(false)
const lastPollAt = ref(null)
const lastPollError = ref(null)

function fmtDate(d) {
  try { return new Date(d).toLocaleString() } catch { return '' }
}

function updateAgentOnlineFlag() {
  if (!lastAgentSeenAt.value) { agentOnline.value = false; return }
  // Agent polls every few seconds — if we haven't heard from it in 2
  // minutes, treat it as offline rather than showing a stale "Online".
  agentOnline.value = (Date.now() - new Date(lastAgentSeenAt.value).getTime()) < 120000
}

async function load() {
  try {
    const r = await api.get('/hikvision/device')
    if (r) {
      deviceId.value = r.id
      hasPassword.value = !!r.has_password
      hasAgentToken.value = !!r.has_agent_token
      lastAgentSeenAt.value = r.last_agent_seen_at || null
      lastPollAt.value = r.last_poll_at || null
      lastPollError.value = r.last_poll_error || null
      updateAgentOnlineFlag()
      Object.assign(form.value, {
        host: r.host || '',
        port: r.port || 80,
        username: r.username || '',
        password: '',
        device_name: r.device_name || '',
        enabled: r.enabled !== undefined ? !!r.enabled : true,
      })
    }
  } catch { /* no device configured yet — leave defaults */ }
}

async function save() {
  saving.value = true
  statusMsg.value = ''
  try {
    const payload = { ...form.value, port: Number(form.value.port) || 80 }
    if (!payload.password) delete payload.password
    const r = await api.put('/hikvision/device', payload)
    deviceId.value = r?.id || deviceId.value
    hasPassword.value = !!r?.has_password
    hasAgentToken.value = !!r?.has_agent_token
    form.value.password = ''
    if (r?.agent_token) newAgentToken.value = r.agent_token
    toast.success('Fingerprint device saved')
  } catch (e) {
    toast.error(e.response?.data?.message || 'Could not save device')
  } finally {
    saving.value = false
  }
}

async function regenerateToken() {
  if (hasAgentToken.value && !confirm('Regenerate the agent token? The bridge agent currently running will stop working until you update its config.js with the new token.')) return
  regenerating.value = true
  try {
    const r = await api.post('/hikvision/device/regenerate-token')
    hasAgentToken.value = true
    newAgentToken.value = r?.agent_token || ''
    toast.success('New agent token generated')
  } catch (e) {
    toast.error(e.response?.data?.message || 'Could not generate a token')
  } finally {
    regenerating.value = false
  }
}

function copyToken() {
  if (!newAgentToken.value) return
  navigator.clipboard?.writeText(newAgentToken.value).then(() => {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }).catch(() => {})
}

onMounted(load)
</script>

<style scoped>
.fdc-notice-important {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  font-size: 12.5px; line-height: 1.5; color: var(--text-secondary);
  background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25);
  margin-bottom: 14px;
}
.fdc-notice-important code { background: var(--bg); padding: 1px 5px; border-radius: 4px; font-size: 11.5px; }
.fdc-token-box {
  margin-top: 14px; padding: 14px; border-radius: var(--radius-sm);
  background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.3);
}
.fdc-token-label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--warning); margin-bottom: 8px; }
.fdc-token-value { display: flex; align-items: center; gap: 8px; }
.fdc-token-value code {
  flex: 1; background: var(--bg); border: 1px solid var(--surface-border); padding: 8px 10px;
  border-radius: var(--radius-sm); font-size: 11.5px; word-break: break-all; font-family: monospace;
}
.fdc-copy-btn {
  padding: 8px 14px; border-radius: var(--radius-sm); border: 1px solid var(--surface-border);
  background: var(--bg); color: var(--text-primary); font-size: 12px; font-weight: 700; cursor: pointer; flex-shrink: 0;
}
.fdc-copy-btn:hover { border-color: var(--primary); }
.fdc-token-hint { font-size: 11.5px; color: var(--text-muted); margin-top: 8px; line-height: 1.5; }
.fdc-token-hint code { background: var(--bg); padding: 1px 5px; border-radius: 4px; }
.fdc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
@media (max-width: 560px) { .fdc-grid { grid-template-columns: 1fr; } }
.fdc-actions { display: flex; gap: 10px; margin-top: 6px; flex-wrap: wrap; }
.fdc-actions .btn { flex: 1; min-width: 140px; }
.fdc-meta { font-size: 11.5px; color: var(--text-muted); margin-top: 10px; display: flex; flex-direction: column; gap: 3px; }
.fdc-meta-error { color: var(--danger); }
.fdc-notice-ok { background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.25); color: var(--success); }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px 16px; border-radius: var(--radius-sm); border: none;
  font-size: 14px; font-weight: 700; cursor: pointer;
  transition: all 0.2s; font-family: var(--font);
}
.btn:disabled { opacity: 0.65; cursor: not-allowed; }
.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: #fff; box-shadow: 0 4px 16px var(--primary-glow);
}
.btn-primary:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 8px 24px var(--primary-glow); }
.btn-secondary {
  background: var(--bg); border: 1px solid var(--surface-border); color: var(--text-primary);
}
.btn-secondary:not(:disabled):hover { border-color: var(--primary); }

.bsc-notice {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 12px; border-radius: var(--radius-sm);
  font-size: 12.5px; line-height: 1.5; color: var(--text-secondary);
  background: rgba(37,99,235,0.06); border: 1px solid rgba(37,99,235,0.15);
  margin-top: 12px;
}
.bsc-notice-error { background: rgba(239,68,68,0.07); border-color: rgba(239,68,68,0.2); color: var(--danger); }
.bsc-spinner-sm {
  width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
  border-radius: 50%; animation: fdc-spin 0.7s linear infinite; flex-shrink: 0;
}
.btn-secondary .bsc-spinner-sm { border-color: rgba(0,0,0,0.15); border-top-color: var(--text-primary); }
@keyframes fdc-spin { to { transform: rotate(360deg); } }
</style>
