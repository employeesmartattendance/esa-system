/**
 * ESA Hikvision Bridge Agent
 * ────────────────────────────
 * Runs on any always-on computer (PC, mini-PC, Raspberry Pi) on the SAME
 * local network as the Hikvision fingerprint terminal. Solves the one
 * problem a cloud-hosted backend (e.g. on Render) can never solve on its
 * own: Render cannot open a connection into a device sitting behind a
 * home/office router's NAT. This agent flips the direction — it reaches
 * OUT to Render over normal outbound HTTPS (same direction a browser
 * already uses), and reaches the device directly over the LAN.
 *
 * What it does, on a loop:
 *   1. Fetches this school's device connection details (host/port/
 *      username/password) from Render, using the agent token below.
 *   2. Talks ISAPI to the physical device (register users, arm
 *      fingerprint capture, poll capture progress, fetch recent match
 *      events) exactly as ESA's backend used to do directly, before it
 *      moved to Render.
 *   3. Executes any queued commands from the admin dashboard (start
 *      capture / delete user) and reports results back.
 *   4. Reports new fingerprint match events back to Render, which turns
 *      each into a check-in token for that employee.
 *
 * Setup:
 *   1. `npm install` in this folder.
 *   2. Copy config.example.js to config.js and fill in:
 *        - backendUrl:   your Render backend's base URL (…onrender.com)
 *        - agentToken:   from ESA → Settings → Fingerprint Device, shown
 *                         once right after you save the device the first
 *                         time (or after "Regenerate Token")
 *   3. `node index.js` — leave this running (see "Running as a service"
 *      in the README for keeping it alive across reboots).
 *
 * No fingerprint image or raw biometric data ever leaves the device or
 * this local machine — only a device-side employeeNo↔match event, exactly
 * like the rest of ESA's biometric design.
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');
const deviceClient = require('./deviceClient');

let config;
try {
  config = require('./config');
} catch {
  console.error('❌ Missing config.js — copy config.example.js to config.js and fill in your backendUrl and agentToken first.');
  process.exit(1);
}

const { backendUrl, agentToken, deviceCommandPollMs = 4000, eventPollMs = 4000 } = config;
if (!backendUrl || !agentToken) {
  console.error('❌ config.js is missing backendUrl or agentToken.');
  process.exit(1);
}

// ── Minimal HTTPS/HTTP client for talking to the Render backend ──
function backendRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, backendUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${agentToken}` };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers,
      timeout: 15000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { /* non-JSON response */ }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(json?.data !== undefined ? json.data : json);
        else reject(new Error(json?.message || `Backend responded HTTP ${res.statusCode}`));
      });
    });
    req.on('timeout', () => req.destroy(new Error('Backend request timed out')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let cachedDevice = null;
let deviceCursor = new Date(Date.now() - 60 * 1000).toISOString().slice(0, 19);

async function refreshDeviceConfig() {
  cachedDevice = await backendRequest('GET', '/api/hikvision/agent/device-config');
  return cachedDevice;
}

async function testConnectionOnce() {
  try {
    const device = await refreshDeviceConfig();
    const result = await deviceClient.testConnection(device);
    await backendRequest('POST', '/api/hikvision/agent/test-result', { ok: result.ok, message: result.message });
    if (result.ok) console.log(`✅ Connected to device: ${result.deviceName || 'Hikvision terminal'} (${result.model || 'unknown model'})`);
    else console.warn(`⚠️  Could not reach device: ${result.message}`);
  } catch (err) {
    console.error('⚠️  Startup connection test failed:', err.message);
  }
}

async function processCommands() {
  if (!cachedDevice) return;
  let commands = [];
  try { commands = await backendRequest('GET', '/api/hikvision/agent/commands'); }
  catch (err) { console.error('Could not fetch commands:', err.message); return; }
  if (!Array.isArray(commands) || !commands.length) return;

  for (const cmd of commands) {
    try {
      if (cmd.type === 'start_capture') {
        console.log(`→ Starting fingerprint capture for employee ${cmd.employee_no} (finger ${cmd.finger_no})`);
        const userResult = await deviceClient.ensureUserOnDevice(cachedDevice, { employeeNo: cmd.employee_no, name: `Employee ${cmd.employee_no}` });
        if (!userResult.ok) throw new Error(userResult.message || 'Could not register user on device');

        const captureResult = await deviceClient.startFingerprintCapture(cachedDevice, { employeeNo: cmd.employee_no, fingerNo: cmd.finger_no });
        if (!captureResult.ok) throw new Error(captureResult.message || 'Device did not start capture');

        await backendRequest('POST', '/api/hikvision/agent/enrollment-result', { command_id: cmd.id, employee_no: cmd.employee_no, status: 'capturing' });
        watchCaptureProgress(cmd);
      } else if (cmd.type === 'delete_user') {
        console.log(`→ Removing employee ${cmd.employee_no} from device`);
        await deviceClient.deleteUserFromDevice(cachedDevice, { employeeNo: cmd.employee_no });
        await backendRequest('POST', '/api/hikvision/agent/enrollment-result', { command_id: cmd.id, employee_no: cmd.employee_no, status: 'removed' }).catch(() => {});
      }
    } catch (err) {
      console.error(`Command ${cmd.type} for ${cmd.employee_no} failed:`, err.message);
      await backendRequest('POST', '/api/hikvision/agent/enrollment-result', { command_id: cmd.id, employee_no: cmd.employee_no, status: 'failed' }).catch(() => {});
    }
  }
}

// Polls the device's own capture-progress endpoint until it finishes or
// times out (~60s), then reports the final result to the backend.
function watchCaptureProgress(cmd) {
  const startedAt = Date.now();
  const interval = setInterval(async () => {
    try {
      const progress = await deviceClient.pollFingerprintCaptureStatus(cachedDevice);
      if (progress.ok && progress.finished) {
        clearInterval(interval);
        console.log(`✅ Fingerprint enrolled for employee ${cmd.employee_no}`);
        await backendRequest('POST', '/api/hikvision/agent/enrollment-result', { employee_no: cmd.employee_no, status: 'enrolled' });
      } else if (progress.ok && progress.failed) {
        clearInterval(interval);
        console.warn(`❌ Fingerprint capture failed for employee ${cmd.employee_no}`);
        await backendRequest('POST', '/api/hikvision/agent/enrollment-result', { employee_no: cmd.employee_no, status: 'failed' });
      } else if (Date.now() - startedAt > 60000) {
        clearInterval(interval);
        console.warn(`⏱️  Fingerprint capture timed out for employee ${cmd.employee_no}`);
        await backendRequest('POST', '/api/hikvision/agent/enrollment-result', { employee_no: cmd.employee_no, status: 'failed' });
      }
    } catch (err) {
      console.error('Capture progress check failed:', err.message);
    }
  }, 2000);
}

async function pollMatchEvents() {
  if (!cachedDevice) return;
  try {
    const result = await deviceClient.fetchRecentMatchEvents(cachedDevice, { sinceIso: deviceCursor });
    if (!result.ok) return;
    deviceCursor = new Date().toISOString().slice(0, 19);
    for (const ev of result.events) {
      try {
        const res = await backendRequest('POST', '/api/hikvision/agent/match-event', { employee_no: ev.employeeNo, matched_at: ev.time });
        if (res?.accepted) console.log(`👆 Fingerprint match: employee ${ev.employeeNo} — sent to ESA`);
      } catch (err) {
        console.error('Could not report match event:', err.message);
      }
    }
  } catch (err) {
    console.error('Could not poll device events:', err.message);
  }
}

async function main() {
  console.log('🚀 ESA Hikvision Bridge Agent starting…');
  console.log(`   Backend: ${backendUrl}`);
  await refreshDeviceConfig();
  await testConnectionOnce();

  setInterval(() => processCommands().catch(err => console.error('Command loop error:', err.message)), deviceCommandPollMs);
  setInterval(() => pollMatchEvents().catch(err => console.error('Match-event loop error:', err.message)), eventPollMs);
  // Periodically refresh device config in case the admin updates host/
  // credentials in the dashboard while the agent is already running.
  setInterval(() => refreshDeviceConfig().catch(err => console.error('Could not refresh device config:', err.message)), 60000);

  console.log('✅ Bridge agent running. Leave this window/process open.');
}

main().catch(err => { console.error('Fatal agent error:', err.message); process.exit(1); });
