/**
 * Hikvision ISAPI Device Client (runs inside the local bridge agent)
 * ────────────────────────────────────────────────────────────────────
 * Talks directly to a Hikvision standalone fingerprint/access terminal
 * (e.g. DS-K1T802 series — keypad + fingerprint scanner + optional card
 * reader) over the LOCAL network using Hikvision's ISAPI protocol (HTTP +
 * digest authentication, XML/JSON bodies).
 *
 * This file runs on the bridge agent machine (on the same LAN as the
 * device), NOT on the Render-hosted backend — Render can't reach devices
 * behind a router's NAT, so this logic moved here. See index.js for how
 * it's used, and hikvision-routes.js on the backend for the cloud side of
 * the conversation this agent has with ESA.
 *
 * What this gives ESA:
 *   1. Enrollment: push an employee record + trigger fingerprint capture
 *      on the physical device (the finger is scanned ON the device itself —
 *      no fingerprint image ever crosses the network, only a template ID).
 *   2. Real-time verification: polls the device's own event log for
 *      fingerprint matches and reports each one back to ESA, which turns
 *      it into a short-lived biometric token — exactly like the existing
 *      face-api flow, so the SAME check-in gate accepts it.
 *   3. Removal: delete a person/fingerprint from the device when an admin
 *      resets an employee's biometric enrollment.
 *
 * No third-party npm dependency required — built on Node's core `http`
 * module with manual RFC 2617 digest-auth handling, since Hikvision
 * terminals use HTTP Digest by default and refuse plain Basic auth.
 */
const http = require('http');
const crypto = require('crypto');

// ── Digest auth helpers (RFC 2617) ──
function parseDigestHeader(header) {
  const out = {};
  const re = /(\w+)=(?:"([^"]*)"|([^,]*))/g;
  let m;
  while ((m = re.exec(header))) out[m[1]] = m[2] !== undefined ? m[2] : m[3];
  return out;
}

function buildDigestAuthHeader({ username, password, method, uri, digest }) {
  const ha1 = crypto.createHash('md5').update(`${username}:${digest.realm}:${password}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
  let response, extra = '';
  if (digest.qop) {
    const nc = '00000001';
    const cnonce = crypto.randomBytes(8).toString('hex');
    response = crypto.createHash('md5').update(`${ha1}:${digest.nonce}:${nc}:${cnonce}:${digest.qop}:${ha2}`).digest('hex');
    extra = `, qop=${digest.qop}, nc=${nc}, cnonce="${cnonce}"`;
  } else {
    response = crypto.createHash('md5').update(`${ha1}:${digest.nonce}:${ha2}`).digest('hex');
  }
  return `Digest username="${username}", realm="${digest.realm}", nonce="${digest.nonce}", uri="${uri}", response="${response}"${extra}${digest.opaque ? `, opaque="${digest.opaque}"` : ''}`;
}

/**
 * Performs a single HTTP request against the device, transparently
 * retrying once with a computed Digest Authorization header if the
 * device responds 401 with a WWW-Authenticate: Digest challenge.
 */
function deviceRequest(device, { method = 'GET', path, body = null, contentType = 'application/json', timeoutMs = 8000 }) {
  const { host, port = 80, username, password } = device;
  if (!host || !username || !password) {
    return Promise.reject(new Error('Device is not configured (host/username/password missing)'));
  }

  const doRequest = (authHeader) => new Promise((resolve, reject) => {
    const headers = { 'Content-Type': contentType };
    if (authHeader) headers['Authorization'] = authHeader;
    if (body) headers['Content-Length'] = Buffer.byteLength(body);

    const req = http.request({ host, port, path, method, headers, timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('Device request timed out')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });

  return doRequest(null).then((first) => {
    if (first.statusCode !== 401) return first;
    const wwwAuth = first.headers['www-authenticate'];
    if (!wwwAuth || !/Digest/i.test(wwwAuth)) return first; // not digest-protected, surface as-is
    const digest = parseDigestHeader(wwwAuth);
    const authHeader = buildDigestAuthHeader({ username, password, method, uri: path, digest });
    return doRequest(authHeader);
  });
}

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

/**
 * Ensures a person record exists on the device for this employee. Hikvision
 * ISAPI identifies people on the device by an `employeeNo` — we use the
 * ESA teacher's Mongo _id so device records map 1:1 back to a Teacher.
 */
async function ensureUserOnDevice(device, { employeeNo, name }) {
  const path = '/ISAPI/AccessControl/UserInfo/Record?format=json';
  const payload = JSON.stringify({
    UserInfo: {
      employeeNo: String(employeeNo),
      name: (name || 'Employee').slice(0, 32),
      userType: 'normal',
      Valid: { enable: true, beginTime: '2020-01-01T00:00:00', endTime: '2037-12-31T23:59:59', timeType: 'local' },
      doorRight: '1',
      RightPlan: [{ doorNo: 1, planTemplateNo: '1' }],
    },
  });
  const res = await deviceRequest(device, { method: 'PUT', path, body: payload });
  // 200 = updated, 400 with "not found" on PUT means create instead
  if (res.statusCode === 200) return { ok: true, created: false };
  const addPath = '/ISAPI/AccessControl/UserInfo/Record?format=json';
  const addRes = await deviceRequest(device, { method: 'POST', path: addPath, body: payload });
  if (addRes.statusCode === 200) return { ok: true, created: true };
  return { ok: false, message: `Device rejected user record (HTTP ${addRes.statusCode})`, raw: addRes.body };
}

/**
 * Starts fingerprint collection MODE on the device for a given employeeNo.
 * The employee then physically places their finger on the scanner (2–3
 * times, per Hikvision's own capture flow) and the device stores the
 * resulting template locally, associated with that employeeNo. This call
 * only arms the device to start capture — it returns immediately.
 */
async function startFingerprintCapture(device, { employeeNo, fingerNo = 1 }) {
  const path = '/ISAPI/AccessControl/CaptureFingerPrint?format=json';
  const payload = JSON.stringify({ CaptureFingerPrintCond: { employeeNo: String(employeeNo), fingerNo } });
  const res = await deviceRequest(device, { method: 'POST', path, body: payload });
  if (res.statusCode === 200) {
    const parsed = safeJsonParse(res.body);
    return { ok: true, data: parsed };
  }
  return { ok: false, message: `Device did not accept capture request (HTTP ${res.statusCode})`, raw: res.body };
}

/** Polls the device for the result of an in-progress fingerprint capture. */
async function pollFingerprintCaptureStatus(device) {
  const path = '/ISAPI/AccessControl/CaptureFingerPrintProgress?format=json';
  const res = await deviceRequest(device, { method: 'GET', path });
  if (res.statusCode !== 200) return { ok: false, message: `HTTP ${res.statusCode}` };
  const parsed = safeJsonParse(res.body) || {};
  // Hikvision reports progress via a status/progress-style field; we
  // normalize the handful of shapes seen across firmware versions.
  const info = parsed.CaptureFingerPrintProgress || parsed;
  const status = (info.status || info.Status || '').toString().toLowerCase();
  return {
    ok: true,
    finished: status.includes('success') || status.includes('ok') || info.progress === 100,
    failed: status.includes('fail') || status.includes('error') || status.includes('timeout'),
    raw: info,
  };
}

/** Removes a person (and their fingerprint templates) from the device. */
async function deleteUserFromDevice(device, { employeeNo }) {
  const path = '/ISAPI/AccessControl/UserInfoDetail/Delete?format=json';
  const payload = JSON.stringify({ UserInfoDetail: { mode: 'byEmployeeNo', EmployeeNoList: [{ employeeNo: String(employeeNo) }] } });
  const res = await deviceRequest(device, { method: 'PUT', path, body: payload });
  return { ok: res.statusCode === 200, statusCode: res.statusCode, raw: res.body };
}

/** Basic reachability + identity check, used by the "Test Connection" admin action. */
async function testConnection(device) {
  const res = await deviceRequest(device, { method: 'GET', path: '/ISAPI/System/deviceInfo?format=json' });
  if (res.statusCode !== 200) return { ok: false, message: `Device responded HTTP ${res.statusCode}`, statusCode: res.statusCode };
  const parsed = safeJsonParse(res.body) || {};
  const info = parsed.DeviceInfo || parsed;
  return { ok: true, deviceName: info.deviceName, model: info.model, serialNumber: info.serialNumber, firmwareVersion: info.firmwareVersion };
}

/**
 * Pulls new Access Control events (AcsEvent search) from the device since
 * a given time, filtered to successful fingerprint matches. Used by the
 * background poller instead of keeping a raw TCP alert stream open, since
 * short HTTP polling is far more reliable across flaky local networks and
 * works identically whether ESA's backend is on the same LAN or reaches
 * the device through a port-forward/VPN.
 */
async function fetchRecentMatchEvents(device, { sinceIso, maxResults = 30 }) {
  const path = '/ISAPI/AccessControl/AcsEvent?format=json';
  const payload = JSON.stringify({
    AcsEventCond: {
      searchID: crypto.randomBytes(6).toString('hex'),
      searchResultPosition: 0,
      maxResults,
      major: 5,   // 5 = "event" major type (access control events)
      minor: 0,   // 0 = all minor types; we filter matches client-side below
      startTime: sinceIso,
      endTime: new Date().toISOString().slice(0, 19),
    },
  });
  const res = await deviceRequest(device, { method: 'POST', path, body: payload });
  if (res.statusCode !== 200) return { ok: false, events: [], message: `HTTP ${res.statusCode}` };
  const parsed = safeJsonParse(res.body) || {};
  const list = (parsed.AcsEvent && parsed.AcsEvent.InfoList) || parsed.InfoList || [];
  // Minor type 1 = fingerprint verify success (Hikvision "verify success" via fingerprint).
  // We also accept 38/75 style card+fingerprint combos some firmwares emit; anything with
  // a non-empty employeeNo and a "success"-ish name is treated as a valid match.
  const matches = list
    .filter(ev => {
      const name = (ev.subEventType || ev.eventDescription || '').toString().toLowerCase();
      const hasEmployee = ev.employeeNoString || ev.employeeNo;
      return hasEmployee && (name.includes('success') || ev.minor === 1 || ev.currentVerifyMode === 'fp' || ev.currentVerifyMode === 'fingerPrint');
    })
    .map(ev => ({
      employeeNo: (ev.employeeNoString || ev.employeeNo || '').toString(),
      time: ev.time || ev.dateTime || new Date().toISOString(),
      verifyMode: ev.currentVerifyMode || 'fingerPrint',
      raw: ev,
    }));
  return { ok: true, events: matches, totalMatches: parsed.AcsEvent?.totalMatches ?? matches.length };
}

module.exports = {
  testConnection,
  ensureUserOnDevice,
  startFingerprintCapture,
  pollFingerprintCaptureStatus,
  deleteUserFromDevice,
  fetchRecentMatchEvents,
};
