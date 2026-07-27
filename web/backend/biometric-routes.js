/**
 * ESA Biometric Verification Routes — WebAuthn (Face ID / fingerprint / Windows Hello)
 * Extends app.js with biometric enrollment + check-in verification. Purely additive —
 * every route here is new, and nothing existing is touched by requiring this module.
 *
 * IMPORTANT — how enrollment actually works: WebAuthn credentials are bound to the
 * secure hardware of one specific device. An administrator can NOT enroll a
 * fingerprint or face on an employee's behalf, and no raw biometric data ever
 * reaches this server — only a public key and a usage counter. The employee
 * enrolls themselves, on their own device, from their own dashboard/app. The
 * administrator can only see enrollment status and revoke/reset a credential
 * (e.g. the employee lost their phone).
 *
 * Receives: app, models ({ Teacher, School, Settings, BiometricCredential }),
 *           authMiddleware, logAction, sendSuccess, sendError, toId
 * Returns:  verifyAndConsumeBiometricToken(teacherId, token) — called by the
 *           check-in routes in app.js and mobile-routes.js to confirm biometric
 *           verification actually happened for this specific check-in attempt.
 */
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const crypto = require('crypto');

module.exports = function registerBiometricRoutes(
  app, models, authMiddleware, logAction, sendSuccess, sendError, toId
) {
  const { Teacher, BiometricCredential } = models;
  const TCH = authMiddleware(['teacher']);
  const SCH = authMiddleware(['school_admin']);

  const RP_NAME = process.env.BIOMETRIC_RP_NAME || 'ESA Attendance';
  // WebAuthn ties every credential to a specific domain (the "Relying Party ID").
  // Set BIOMETRIC_RP_ID to your real production domain (e.g. esa-system.onrender.com,
  // with no protocol/path) once you have one for employees to use day-to-day —
  // credentials registered under one RP ID will NOT work if this changes later.
  // Falls back to localhost for local development only.
  const RP_ID = process.env.BIOMETRIC_RP_ID || 'localhost';
  const ORIGINS = (process.env.BIOMETRIC_ORIGINS || `https://${RP_ID}`).split(',').map(o => o.trim());

  // Short-lived, in-memory state — same pattern as the existing `teacherLocations`
  // Map in app.js. This is ephemeral (seconds-to-minutes) data, not something that
  // belongs in a persistent collection.
  const pendingChallenges = new Map();  // teacherId -> { challenge, type, expiresAt }
  const verifiedTokens    = new Map();  // token -> { teacherId, expiresAt }
  const CHALLENGE_TTL_MS  = 2 * 60 * 1000; // 2 min to complete the WebAuthn ceremony
  const TOKEN_TTL_MS      = 90 * 1000;      // 90s to submit the check-in after verifying

  function cleanupExpired(map) {
    const now = Date.now();
    for (const [key, val] of map) if (val.expiresAt < now) map.delete(key);
  }
  function bufToB64(buf) { return Buffer.from(buf).toString('base64'); }
  function b64ToBuf(str)  { return new Uint8Array(Buffer.from(str, 'base64')); }

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

  // ── 2. Registration — start (employee's own device) ──
  // Locked to one-time setup: once a credential exists for this employee, it can
  // only be cleared by a school admin (see route 6 below) — the employee cannot
  // re-enroll or swap devices on their own. This is intentional: it's what stops
  // someone else's face/fingerprint from silently replacing the real employee's.
  app.post('/api/biometric/register/options', TCH, async (req, res) => {
    try {
      const t = await getTeacherOr404(req, res); if (!t) return;
      const existing = await BiometricCredential.find({ teacher_id: t._id }).lean();
      if (existing.length) {
        return sendError(res, 'Biometric verification is already set up on this account. Ask your admin to reset it if you need to change devices.', 409);
      }
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: new TextEncoder().encode(toId(t._id)),
        userName: req.user.email,
        userDisplayName: req.user.name,
        attestationType: 'none',
        excludeCredentials: [],
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required', authenticatorAttachment: 'platform' },
      });
      pendingChallenges.set(toId(t._id), { challenge: options.challenge, type: 'register', expiresAt: Date.now() + CHALLENGE_TTL_MS });
      return sendSuccess(res, options);
    } catch (err) { console.error('Biometric register/options error:', err); return sendError(res, 'Could not start biometric enrollment', 500); }
  });

  // ── 3. Registration — verify the device's response and store the credential ──
  app.post('/api/biometric/register/verify', TCH, async (req, res) => {
    try {
      const t = await getTeacherOr404(req, res); if (!t) return;
      cleanupExpired(pendingChallenges);
      const pending = pendingChallenges.get(toId(t._id));
      if (!pending || pending.type !== 'register') return sendError(res, 'Enrollment session expired — please try again', 400);

      // Re-check at verify time too, in case a credential was created by a
      // concurrent request between /register/options and here.
      const alreadyEnrolled = await BiometricCredential.exists({ teacher_id: t._id });
      if (alreadyEnrolled) {
        pendingChallenges.delete(toId(t._id));
        return sendError(res, 'Biometric verification is already set up on this account.', 409);
      }

      const verification = await verifyRegistrationResponse({
        response: req.body,
        expectedChallenge: pending.challenge,
        expectedOrigin: ORIGINS,
        expectedRPID: RP_ID,
        requireUserVerification: true,
      });
      if (!verification.verified || !verification.registrationInfo) return sendError(res, 'Could not verify biometric enrollment');

      const { credential } = verification.registrationInfo;
      const ua = (req.headers['user-agent'] || '').slice(0, 120);
      await BiometricCredential.findOneAndUpdate(
        { credential_id: credential.id },
        {
          teacher_id: t._id, school_id: t.school_id, credential_id: credential.id,
          public_key: bufToB64(credential.publicKey), counter: credential.counter,
          transports: credential.transports || [], device_label: ua || 'Registered device',
        },
        { upsert: true, new: true }
      );
      pendingChallenges.delete(toId(t._id));
      await logAction('BIOMETRIC_ENROLLED', req.user._id, 'Employee enrolled biometric verification', req.ip);
      return sendSuccess(res, { enrolled: true }, 'Biometric verification set up successfully');
    } catch (err) { console.error('Biometric register/verify error:', err); return sendError(res, 'Could not verify biometric enrollment', 500); }
  });

  // ── 4. Check-in verification — start ──
  app.post('/api/biometric/auth/options', TCH, async (req, res) => {
    try {
      const t = await getTeacherOr404(req, res); if (!t) return;
      const creds = await BiometricCredential.find({ teacher_id: t._id }).lean();
      if (!creds.length) return sendError(res, 'No biometric verification set up yet', 400);

      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        userVerification: 'required',
        allowCredentials: creds.map(c => ({ id: c.credential_id, transports: c.transports })),
      });
      pendingChallenges.set(toId(t._id), { challenge: options.challenge, type: 'auth', expiresAt: Date.now() + CHALLENGE_TTL_MS });
      return sendSuccess(res, options);
    } catch (err) { console.error('Biometric auth/options error:', err); return sendError(res, 'Could not start biometric verification', 500); }
  });

  // ── 5. Check-in verification — verify the response, issue a short-lived token ──
  app.post('/api/biometric/auth/verify', TCH, async (req, res) => {
    try {
      const t = await getTeacherOr404(req, res); if (!t) return;
      cleanupExpired(pendingChallenges);
      const pending = pendingChallenges.get(toId(t._id));
      if (!pending || pending.type !== 'auth') return sendError(res, 'Verification session expired — please try again', 400);

      const cred = await BiometricCredential.findOne({ credential_id: req.body.id, teacher_id: t._id });
      if (!cred) return sendError(res, 'Biometric credential not recognized', 400);

      const verification = await verifyAuthenticationResponse({
        response: req.body,
        expectedChallenge: pending.challenge,
        expectedOrigin: ORIGINS,
        expectedRPID: RP_ID,
        credential: { id: cred.credential_id, publicKey: b64ToBuf(cred.public_key), counter: cred.counter, transports: cred.transports },
        requireUserVerification: true,
      });
      if (!verification.verified) return sendError(res, 'Biometric verification failed');

      cred.counter = verification.authenticationInfo.newCounter;
      cred.last_used_at = new Date();
      await cred.save();
      pendingChallenges.delete(toId(t._id));

      cleanupExpired(verifiedTokens);
      const token = crypto.randomBytes(24).toString('hex');
      verifiedTokens.set(token, { teacherId: toId(t._id), expiresAt: Date.now() + TOKEN_TTL_MS });
      return sendSuccess(res, { verified: true, biometric_token: token });
    } catch (err) { console.error('Biometric auth/verify error:', err); return sendError(res, 'Biometric verification failed', 500); }
  });

  // ── 6. Admin: reset/revoke an employee's biometric enrollment (school-scoped) ──
  // This is the ONLY way an enrolled credential can be cleared. There is no
  // employee self-service removal — once set up, it's locked until an admin
  // resets it (e.g. lost/replaced phone), which is what keeps a single
  // enrolled face/fingerprint tied to the real employee for the long term.
  app.delete('/api/biometric/credential/:teacherId', SCH, async (req, res) => {
    try {
      const t = await Teacher.findOne({ _id: req.params.teacherId, school_id: req.user.school_id });
      if (!t) return sendError(res, 'Employee not found', 404);
      await BiometricCredential.deleteMany({ teacher_id: t._id });
      await logAction('BIOMETRIC_RESET', req.user._id, `Reset biometric enrollment for employee ${req.params.teacherId}`, req.ip);
      return sendSuccess(res, null, 'Biometric enrollment reset — the employee can enroll again on their device');
    } catch (err) { console.error('Biometric reset error:', err); return sendError(res, 'Server error', 500); }
  });

  console.log('✅ Biometric verification routes registered');

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
