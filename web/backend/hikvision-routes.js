/**
 * ESA Hikvision Fingerprint Device Routes (cloud/Render side)
 * ──────────────────────────────────────────────────────────────
 * IMPORTANT: this backend runs on Render, in the cloud. The Hikvision
 * fingerprint terminal sits on a local network behind a router (NAT) — it
 * has no public IP, so Render can never open a connection TO it directly.
 * That's true no matter how this code is written; it's a networking fact,
 * not a bug.
 *
 * The fix is the standard pattern for cloud-connected local hardware: flip
 * the direction. A small script (see /hikvision-agent at the project root)
 * runs on any always-on PC/mini-PC/Raspberry Pi on the SAME LAN as the
 * fingerprint device. That agent:
 *   - talks ISAPI to the device directly (works fine — same network)
 *   - calls OUT to this Render backend over normal outbound HTTPS
 *     (the same direction a browser already talks to Render in, so no
 *     port-forwarding or VPN is needed)
 *
 * This file is the Render-side half of that conversation:
 *   • Admin-facing routes (device config, enrollment start/status/remove,
 *     employee self-status) — used by the dashboard, unchanged in shape
 *     from the person's point of view.
 *   • Agent-facing routes (/api/hikvision/agent/*) — authenticated with a
 *     per-device `agent_token` (shown once after saving the device),
 *     which the bridge script polls and posts results to.
 *
 * Flow:
 *   1. Admin configures the device (IP/host, port, ISAPI username/password)
 *      from Settings → Fingerprint Device, and installs the bridge agent
 *      on a local machine with the printed agent token.
 *   2. Admin clicks "Start Capture" for an employee → this queues a
 *      command in HikvisionAgentCommand (status: 'queued').
 *   3. The bridge agent polls /api/hikvision/agent/commands every few
 *      seconds, picks up the command, talks to the device locally to
 *      register the user + arm fingerprint capture, and reports progress
 *      back via /api/hikvision/agent/enrollment-result.
 *   4. The bridge agent separately polls the device's own event log for
 *      fingerprint matches and posts them to
 *      /api/hikvision/agent/match-event — each match becomes a
 *      short-lived biometric_token, exactly like a successful face
 *      verification, so the SAME check-in gate accepts it.
 *
 * Receives: app, models ({ Teacher, School, Settings, HikvisionDevice,
 *           HikvisionEnrollment, HikvisionAgentCommand }), authMiddleware,
 *           logAction, sendSuccess, sendError, toId, issueBiometricToken
 */
const crypto = require('crypto');

module.exports = function registerHikvisionRoutes(
  app, models, authMiddleware, logAction, sendSuccess, sendError, toId, issueBiometricToken
) {
  const { Teacher, HikvisionDevice, HikvisionEnrollment, HikvisionAgentCommand } = models;
  const SCH = authMiddleware(['school_admin']);
  const TCH = authMiddleware(['teacher']);

  function deviceToClient(d, { includeToken = false } = {}) {
    if (!d) return null;
    return {
      id: toId(d._id),
      host: d.host,
      port: d.port,
      username: d.username,
      has_password: !!d.password,
      enabled: d.enabled,
      device_name: d.device_name || null,
      last_test_ok: d.last_test_ok,
      last_tested_at: d.last_tested_at,
      last_poll_at: d.last_poll_at,
      last_poll_error: d.last_poll_error || null,
      last_agent_seen_at: d.last_agent_seen_at || null,
      has_agent_token: !!d.agent_token,
      agent_token: includeToken ? d.agent_token : undefined,
    };
  }

  async function getSchoolDevice(schoolId) {
    return HikvisionDevice.findOne({ school_id: schoolId });
  }

  // Resolves a device from an agent's bearer token. Used by every
  // /api/hikvision/agent/* route so the bridge script only ever needs
  // this one token, never an admin login.
  async function deviceFromAgentAuth(req) {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : (req.headers['x-agent-token'] || '').toString().trim();
    if (!token) return null;
    return HikvisionDevice.findOne({ agent_token: token, enabled: true });
  }

  // ── 1. Get current device config (admin) ──
  app.get('/api/hikvision/device', SCH, async (req, res) => {
    try {
      const device = await getSchoolDevice(req.user.school_id);
      return sendSuccess(res, deviceToClient(device));
    } catch (err) { console.error('Hikvision get device error:', err); return sendError(res, 'Server error', 500); }
  });

  // ── 2. Create/update device config (admin) ──
  // Generates a fresh agent_token the first time a device is created, and
  // returns it ONCE in the response so it can be shown to the admin for
  // pasting into the bridge agent's config — it's not retrievable again
  // afterwards (only its presence, via has_agent_token).
  app.put('/api/hikvision/device', SCH, async (req, res) => {
    try {
      const { host, port, username, password, enabled, device_name } = req.body || {};
      if (!host || !username) return sendError(res, 'Device host and username are required', 400);

      let device = await getSchoolDevice(req.user.school_id);
      const isNew = !device;
      if (!device) device = new HikvisionDevice({ school_id: req.user.school_id });

      device.host = String(host).trim();
      device.port = port ? Number(port) : 80;
      device.username = String(username).trim();
      if (password) device.password = String(password); // only overwrite if a new one was supplied
      device.enabled = enabled !== undefined ? !!enabled : device.enabled;
      device.device_name = device_name || device.device_name;
      if (!device.agent_token) device.agent_token = crypto.randomBytes(24).toString('hex');
      await device.save();

      await logAction('HIKVISION_DEVICE_SAVED', req.user._id, `Fingerprint device configured (${device.host}:${device.port})`, req.ip);
      return sendSuccess(res, deviceToClient(device, { includeToken: isNew }), 'Device saved');
    } catch (err) { console.error('Hikvision save device error:', err); return sendError(res, 'Server error', 500); }
  });

  // ── 3. Regenerate the agent token (admin) — e.g. if it leaked or the ──
  // ── bridge machine is being replaced. Shown once, same as on creation. ──
  app.post('/api/hikvision/device/regenerate-token', SCH, async (req, res) => {
    try {
      const device = await getSchoolDevice(req.user.school_id);
      if (!device) return sendError(res, 'No device configured yet', 404);
      device.agent_token = crypto.randomBytes(24).toString('hex');
      await device.save();
      await logAction('HIKVISION_AGENT_TOKEN_REGENERATED', req.user._id, 'Regenerated Hikvision bridge agent token', req.ip);
      return sendSuccess(res, deviceToClient(device, { includeToken: true }), 'New agent token generated — update your bridge agent config with it');
    } catch (err) { console.error('Hikvision regenerate token error:', err); return sendError(res, 'Server error', 500); }
  });

  // ── 4. Admin: list enrollment status for all employees ──
  app.get('/api/hikvision/enrollments', SCH, async (req, res) => {
    try {
      const rows = await HikvisionEnrollment.find({ school_id: req.user.school_id }).lean();
      const map = {};
      rows.forEach(r => { map[toId(r.teacher_id)] = { status: r.status, employee_no: r.employee_no, enrolled_at: r.enrolled_at, finger_no: r.finger_no }; });
      return sendSuccess(res, map);
    } catch (err) { console.error('Hikvision list enrollments error:', err); return sendError(res, 'Server error', 500); }
  });

  // ── 5. Admin: start fingerprint enrollment for one employee ──
  // Render can't talk to the device itself, so this just queues a command
  // for the bridge agent to pick up on its next poll. The employee should
  // already be standing at the physical device — the agent arms capture
  // mode almost immediately (agent poll interval is a few seconds).
  app.post('/api/hikvision/enroll/:teacherId', SCH, async (req, res) => {
    try {
      const device = await getSchoolDevice(req.user.school_id);
      if (!device || !device.enabled) return sendError(res, 'Fingerprint device is not configured or is disabled', 400);
      if (!device.agent_token) return sendError(res, 'This device has no bridge agent set up yet — see the Fingerprint Device setup instructions', 400);

      const teacher = await Teacher.findOne({ _id: req.params.teacherId, school_id: req.user.school_id }).populate('user_id');
      if (!teacher) return sendError(res, 'Employee not found', 404);

      const employeeNo = teacher._id.toString();
      const fingerNo = Number(req.body?.finger_no) || 1;

      await HikvisionAgentCommand.create({
        school_id: req.user.school_id, type: 'start_capture', employee_no: employeeNo, finger_no: fingerNo, status: 'queued',
      });

      await HikvisionEnrollment.findOneAndUpdate(
        { teacher_id: teacher._id },
        { teacher_id: teacher._id, school_id: req.user.school_id, employee_no: employeeNo, finger_no: fingerNo, status: 'pending_capture', started_at: new Date() },
        { upsert: true }
      );

      await logAction('HIKVISION_ENROLL_QUEUED', req.user._id, `Queued fingerprint capture for employee ${employeeNo}`, req.ip);
      return sendSuccess(res, { employee_no: employeeNo, finger_no: fingerNo }, 'Capture queued — have the employee stand at the device now. It starts within a few seconds.');
    } catch (err) {
      console.error('Hikvision enroll error:', err);
      return sendError(res, err.message || 'Could not queue enrollment', 500);
    }
  });

  // ── 6. Admin/employee dashboard: poll capture progress ──
  // Purely reads the ESA-side enrollment record, which the bridge agent
  // updates via /api/hikvision/agent/enrollment-result as it makes
  // progress on the device — this route itself never talks to hardware.
  app.get('/api/hikvision/enroll/:teacherId/progress', SCH, async (req, res) => {
    try {
      const enrollment = await HikvisionEnrollment.findOne({ teacher_id: req.params.teacherId, school_id: req.user.school_id }).lean();
      if (!enrollment) return sendError(res, 'No enrollment in progress for this employee', 404);
      return sendSuccess(res, { status: enrollment.status });
    } catch (err) { console.error('Hikvision progress error:', err); return sendError(res, 'Server error', 500); }
  });

  // ── 7. Admin: remove an employee's fingerprint enrollment (device + DB) ──
  app.delete('/api/hikvision/enroll/:teacherId', SCH, async (req, res) => {
    try {
      const enrollment = await HikvisionEnrollment.findOne({ teacher_id: req.params.teacherId, school_id: req.user.school_id });
      if (!enrollment) return sendError(res, 'No fingerprint enrollment found for this employee', 404);

      // Queue device-side deletion for the bridge agent; clear the ESA
      // record immediately so the UI/check-in gate reflect "not enrolled"
      // right away rather than waiting on the agent's next poll.
      await HikvisionAgentCommand.create({
        school_id: req.user.school_id, type: 'delete_user', employee_no: enrollment.employee_no, status: 'queued',
      });
      await HikvisionEnrollment.deleteOne({ _id: enrollment._id });
      await logAction('HIKVISION_ENROLL_RESET', req.user._id, `Removed fingerprint enrollment for employee ${enrollment.employee_no}`, req.ip);
      return sendSuccess(res, null, 'Fingerprint enrollment removed');
    } catch (err) { console.error('Hikvision remove enrollment error:', err); return sendError(res, 'Server error', 500); }
  });

  // ── 8. Employee: check their own fingerprint enrollment status ──
  app.get('/api/hikvision/self/status', TCH, async (req, res) => {
    try {
      const teacher = await Teacher.findOne({ user_id: req.user._id }).lean();
      if (!teacher) return sendError(res, 'Employee profile not found', 404);
      const enrollment = await HikvisionEnrollment.findOne({ teacher_id: teacher._id }).lean();
      return sendSuccess(res, {
        enrolled: enrollment?.status === 'enrolled',
        status: enrollment?.status || 'not_enrolled',
        enrolled_at: enrollment?.enrolled_at || null,
      });
    } catch (err) { console.error('Hikvision self status error:', err); return sendError(res, 'Server error', 500); }
  });

  // ── 9. Employee: check if a fresh fingerprint match token is ready ──
  // The check-in screen polls this right after asking the employee to
  // scan at the device; once the bridge agent has reported a match event
  // for them it returns a ready-to-use biometric_token, otherwise "waiting".
  app.get('/api/hikvision/self/latest-match', TCH, async (req, res) => {
    try {
      const teacher = await Teacher.findOne({ user_id: req.user._id }).lean();
      if (!teacher) return sendError(res, 'Employee profile not found', 404);
      const enrollment = await HikvisionEnrollment.findOne({ teacher_id: teacher._id }).lean();
      if (!enrollment || enrollment.status !== 'enrolled') return sendSuccess(res, { ready: false, reason: 'not_enrolled' });

      const pending = pendingMatchTokens.get(toId(teacher._id));
      if (!pending) return sendSuccess(res, { ready: false });

      pendingMatchTokens.delete(toId(teacher._id)); // one-time handoff to the frontend
      return sendSuccess(res, { ready: true, biometric_token: pending.token, matched_at: pending.matchedAt });
    } catch (err) { console.error('Hikvision latest-match error:', err); return sendError(res, 'Server error', 500); }
  });

  // ══════════════════════════════════════════════════════════════════
  // ── AGENT-FACING ROUTES ── called by the local bridge script only ──
  // ══════════════════════════════════════════════════════════════════

  // ── A1. Agent: fetch device connection details it should use to talk ──
  // ── to the physical terminal on the local network ──
  app.get('/api/hikvision/agent/device-config', async (req, res) => {
    try {
      const device = await deviceFromAgentAuth(req);
      if (!device) return sendError(res, 'Invalid or unknown agent token', 401);
      device.last_agent_seen_at = new Date();
      await device.save();
      return sendSuccess(res, { host: device.host, port: device.port, username: device.username, password: device.password, device_name: device.device_name });
    } catch (err) { console.error('Hikvision agent device-config error:', err); return sendError(res, 'Server error', 500); }
  });

  // ── A2. Agent: report a connection test result back (mirrors the ──
  // ── admin "Test Connection" button, but run FROM the local network) ──
  app.post('/api/hikvision/agent/test-result', async (req, res) => {
    try {
      const device = await deviceFromAgentAuth(req);
      if (!device) return sendError(res, 'Invalid or unknown agent token', 401);
      const { ok, message } = req.body || {};
      device.last_tested_at = new Date();
      device.last_test_ok = !!ok;
      device.last_agent_seen_at = new Date();
      if (!ok) device.last_poll_error = message || 'Agent reported connection failure';
      await device.save();
      return sendSuccess(res, null);
    } catch (err) { console.error('Hikvision agent test-result error:', err); return sendError(res, 'Server error', 500); }
  });

  // ── A3. Agent: pull queued commands (start_capture / delete_user) ──
  app.get('/api/hikvision/agent/commands', async (req, res) => {
    try {
      const device = await deviceFromAgentAuth(req);
      if (!device) return sendError(res, 'Invalid or unknown agent token', 401);
      device.last_agent_seen_at = new Date();
      await device.save();

      const commands = await HikvisionAgentCommand.find({ school_id: device.school_id, status: 'queued' }).sort({ created_at: 1 }).limit(20);
      const ids = commands.map(c => c._id);
      if (ids.length) await HikvisionAgentCommand.updateMany({ _id: { $in: ids } }, { status: 'sent', sent_at: new Date() });

      return sendSuccess(res, commands.map(c => ({ id: toId(c._id), type: c.type, employee_no: c.employee_no, finger_no: c.finger_no })));
    } catch (err) { console.error('Hikvision agent commands error:', err); return sendError(res, 'Server error', 500); }
  });

  // ── A4. Agent: report enrollment progress/result for a command ──
  app.post('/api/hikvision/agent/enrollment-result', async (req, res) => {
    try {
      const device = await deviceFromAgentAuth(req);
      if (!device) return sendError(res, 'Invalid or unknown agent token', 401);
      const { command_id, employee_no, status } = req.body || {}; // status: 'capturing' | 'enrolled' | 'failed'
      if (!employee_no || !status) return sendError(res, 'employee_no and status are required', 400);

      if (command_id) await HikvisionAgentCommand.updateOne({ _id: command_id }, { status: status === 'failed' ? 'failed' : 'done' }).catch(() => {});

      // 'removed' is reported by delete_user commands, whose ESA-side
      // enrollment record is already deleted synchronously when the admin
      // clicks remove — nothing further to update here in that case, and
      // it's not one of HikvisionEnrollment's own status values.
      if (status === 'removed') {
        device.last_agent_seen_at = new Date();
        await device.save();
        return sendSuccess(res, null);
      }

      const enrollment = await HikvisionEnrollment.findOne({ employee_no, school_id: device.school_id });
      if (enrollment) {
        enrollment.status = status;
        if (status === 'enrolled') enrollment.enrolled_at = new Date();
        await enrollment.save();
        if (status === 'enrolled') await logAction('HIKVISION_ENROLL_COMPLETE', null, `Fingerprint enrolled for employee ${employee_no} (via bridge agent)`, req.ip);
      }
      device.last_agent_seen_at = new Date();
      await device.save();
      return sendSuccess(res, null);
    } catch (err) { console.error('Hikvision agent enrollment-result error:', err); return sendError(res, 'Server error', 500); }
  });

  // ── A5. Agent: report a fingerprint match event from the device's log ──
  // Turns the match into the same short-lived biometric_token the face
  // verification flow issues, so check-in accepts it identically.
  app.post('/api/hikvision/agent/match-event', async (req, res) => {
    try {
      const device = await deviceFromAgentAuth(req);
      if (!device) return sendError(res, 'Invalid or unknown agent token', 401);
      const { employee_no, matched_at } = req.body || {};
      if (!employee_no) return sendError(res, 'employee_no is required', 400);

      device.last_agent_seen_at = new Date();
      await device.save();

      const enrollment = await HikvisionEnrollment.findOne({ employee_no, school_id: device.school_id, status: 'enrolled' }).lean();
      if (!enrollment) return sendSuccess(res, { accepted: false, reason: 'not_enrolled' });

      const teacherId = toId(enrollment.teacher_id);
      const token = issueBiometricToken(teacherId);
      pendingMatchTokens.set(teacherId, { token, matchedAt: matched_at || new Date().toISOString() });
      return sendSuccess(res, { accepted: true });
    } catch (err) { console.error('Hikvision agent match-event error:', err); return sendError(res, 'Server error', 500); }
  });

  console.log('✅ Hikvision fingerprint device routes registered (bridge-agent mode — Render never contacts the device directly)');

  // In-memory handoff of fingerprint match tokens to the check-in screen;
  // populated by the agent's match-event calls above, drained by
  // /api/hikvision/self/latest-match. Stale (unclaimed) entries are swept
  // periodically so this never grows unbounded.
  const pendingMatchTokens = new Map(); // teacherId -> { token, matchedAt }
  setInterval(() => {
    const now = Date.now();
    for (const [teacherId, val] of pendingMatchTokens) {
      if (now - new Date(val.matchedAt).getTime() > 120000) pendingMatchTokens.delete(teacherId);
    }
  }, 30000);
};
