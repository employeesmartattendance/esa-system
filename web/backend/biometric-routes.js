/**
 * ESA Biometric Verification Routes — on-device face recognition (in-house).
 * Extends app.js with biometric enrollment + check-in verification. Purely additive —
 * every route here is new, and nothing existing is touched by requiring this module.
 *
 * How this works: the browser captures a live camera frame, runs it through
 * face-api.js entirely on the employee's own device, and sends up only a
 * 128-length numeric face descriptor (not a photo, not raw video) — captured
 * once at enrollment and again at every check-in for comparison. No image ever
 * reaches this server. Matching is a Euclidean distance check between the two
 * descriptors against a fixed threshold.
 *
 * NOTE: fingerprint sensors are not reachable from a browser/webpage at all —
 * there is no web API that exposes raw fingerprint hardware to JS. Face
 * recognition is the only biometric factor a from-scratch, non-WebAuthn system
 * can actually implement, so that's what this covers.
 *
 * Receives: app, models ({ Teacher, School, Settings, BiometricCredential }),
 *           authMiddleware, logAction, sendSuccess, sendError, toId
 * Returns:  verifyAndConsumeBiometricToken(teacherId, token) — called by the
 *           check-in routes in app.js and mobile-routes.js to confirm biometric
 *           verification actually happened for this specific check-in attempt.
 */
const crypto = require('crypto');

// Lower = stricter. 0.5 is face-api.js's standard "same person" threshold —
// tight enough to reject a different person, loose enough to tolerate normal
// lighting/angle variance between enrollment and a later check-in.
const MATCH_THRESHOLD = 0.5;
const DESCRIPTOR_LENGTH = 128;

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; sum += d * d; }
  return Math.sqrt(sum);
}

function isValidDescriptor(d) {
  return Array.isArray(d) && d.length === DESCRIPTOR_LENGTH && d.every(n => typeof n === 'number' && Number.isFinite(n));
}

module.exports = function registerBiometricRoutes(
  app, models, authMiddleware, logAction, sendSuccess, sendError, toId
) {
  const { Teacher, BiometricCredential } = models;
  const TCH = authMiddleware(['teacher']);
  const SCH = authMiddleware(['school_admin']);

  // Short-lived, in-memory state — same pattern as the existing `teacherLocations`
  // Map in app.js. This is ephemeral (seconds-to-minutes) data, not something that
  // belongs in a persistent collection.
  const verifiedTokens  = new Map(); // token -> { teacherId, expiresAt }
  const TOKEN_TTL_MS    = 90 * 1000;  // 90s to submit the check-in after verifying

  function cleanupExpired(map) {
    const now = Date.now();
    for (const [key, val] of map) if (val.expiresAt < now) map.delete(key);
  }

  async function getTeacherOr404(req, res) {
    const t = await Teacher.findOne({ user_id: req.user._id }).lean();
    if (!t) { sendError(res, 'Employee profile not found', 404); return null; }
    return t;
  }

  // ── 1. Enrollment status (the logged-in employee's own) ──
  app.get('/api/biometric/status', TCH, async (req, res) => {
    try {
      const t = await getTeacherOr404(req, res); if (!t) return;
      const cred = await BiometricCredential.findOne({ teacher_id: t._id }).sort({ createdAt: -1 }).lean();
      return sendSuccess(res, { enrolled: !!cred, device_label: cred?.device_label || null, enrolled_at: cred?.createdAt || null });
    } catch (err) { console.error('Biometric status error:', err); return sendError(res, 'Server error', 500); }
  });

  // ── 2. Registration — store the employee's face descriptor ──
  // Locked to one-time setup: once a credential exists for this employee, it can
  // only be cleared by a school admin (see route 5 below) — the employee cannot
  // re-enroll on their own. This is intentional: it's what stops someone else's
  // face from silently replacing the real employee's.
  app.post('/api/biometric/register', TCH, async (req, res) => {
    try {
      const t = await getTeacherOr404(req, res); if (!t) return;
      const { descriptor } = req.body || {};
      if (!isValidDescriptor(descriptor)) return sendError(res, 'No face detected clearly — please try again', 400);

      const existing = await BiometricCredential.exists({ teacher_id: t._id });
      if (existing) {
        return sendError(res, 'Biometric verification is already set up on this account. Ask your admin to reset it if you need to re-enroll.', 409);
      }

      const ua = (req.headers['user-agent'] || '').slice(0, 120);
      await BiometricCredential.create({
        teacher_id: t._id, school_id: t.school_id, face_descriptor: descriptor,
        device_label: ua || 'Registered device',
      });
      await logAction('BIOMETRIC_ENROLLED', req.user._id, 'Employee enrolled biometric verification', req.ip);
      return sendSuccess(res, { enrolled: true }, 'Biometric verification set up successfully');
    } catch (err) {
      // A duplicate-key error (code 11000) here means the unique index on
      // teacher_id caught a race: another register request for this same
      // teacher committed between our exists() check above and this create()
      // call. That is not a server crash and not a face/camera problem — it's
      // the same "already enrolled" situation as the 409 above, just caught
      // slightly later, so it gets the exact same message and status instead
      // of the generic 500 (which previously read as an unexplained failure
      // and invited an endless, always-failing retry).
      if (err && err.code === 11000) {
        return sendError(res, 'Biometric verification is already set up on this account. Ask your admin to reset it if you need to re-enroll.', 409);
      }
      console.error('Biometric register error:', err);
      return sendError(res, 'Could not set up biometric verification', 500);
    }
  });

  // ── 3. Check-in verification — compare a freshly captured descriptor against
  //       the stored one, and on match issue a short-lived token ──
  app.post('/api/biometric/verify', TCH, async (req, res) => {
    try {
      const t = await getTeacherOr404(req, res); if (!t) return;
      const { descriptor } = req.body || {};
      if (!isValidDescriptor(descriptor)) return sendError(res, 'No face detected clearly — please try again', 400);

      const cred = await BiometricCredential.findOne({ teacher_id: t._id }).sort({ createdAt: -1 });
      if (!cred) return sendError(res, 'No biometric verification set up yet', 400);

      const distance = euclideanDistance(descriptor, cred.face_descriptor);
      if (distance > MATCH_THRESHOLD) {
        await logAction('BIOMETRIC_MISMATCH', req.user._id, 'Biometric verification did not match', req.ip);
        return sendError(res, 'Face did not match — please try again in good lighting, facing the camera directly', 401);
      }

      cred.last_used_at = new Date();
      await cred.save();

      cleanupExpired(verifiedTokens);
      const token = crypto.randomBytes(24).toString('hex');
      verifiedTokens.set(token, { teacherId: toId(t._id), expiresAt: Date.now() + TOKEN_TTL_MS });
      return sendSuccess(res, { verified: true, biometric_token: token });
    } catch (err) { console.error('Biometric verify error:', err); return sendError(res, 'Biometric verification failed', 500); }
  });

  // ── 4. Employee self-service: remove their own enrollment (e.g. lighting/
  //       appearance changed enough that verification keeps failing) ──
  app.delete('/api/biometric/self', TCH, async (req, res) => {
    try {
      const t = await getTeacherOr404(req, res); if (!t) return;
      await BiometricCredential.deleteMany({ teacher_id: t._id });
      await logAction('BIOMETRIC_SELF_RESET', req.user._id, 'Employee removed their own biometric enrollment', req.ip);
      return sendSuccess(res, null, 'Biometric enrollment removed — you can set it up again anytime');
    } catch (err) { console.error('Biometric self-remove error:', err); return sendError(res, 'Server error', 500); }
  });

  // ── 5. Admin: reset/revoke an employee's biometric enrollment (school-scoped) ──
  app.delete('/api/biometric/credential/:teacherId', SCH, async (req, res) => {
    try {
      const t = await Teacher.findOne({ _id: req.params.teacherId, school_id: req.user.school_id });
      if (!t) return sendError(res, 'Employee not found', 404);
      await BiometricCredential.deleteMany({ teacher_id: t._id });
      await logAction('BIOMETRIC_RESET', req.user._id, `Reset biometric enrollment for employee ${req.params.teacherId}`, req.ip);
      return sendSuccess(res, null, 'Biometric enrollment reset — the employee can enroll again on their device');
    } catch (err) { console.error('Biometric reset error:', err); return sendError(res, 'Server error', 500); }
  });

  console.log('✅ Biometric verification routes registered (on-device face recognition)');

  // ── Consumed by the check-in routes in app.js and mobile-routes.js ──
  return async function verifyAndConsumeBiometricToken(teacherId, token) {
    cleanupExpired(verifiedTokens);
    if (!token) return { ok: false, message: 'Biometric verification is required to check in' };
    const rec = verifiedTokens.get(token);
    if (!rec || rec.teacherId !== toId(teacherId)) return { ok: false, message: 'Biometric verification is missing or expired — please verify again' };
    verifiedTokens.delete(token); // one-time use — can't be replayed on a second check-in
    return { ok: true };
  };
};
