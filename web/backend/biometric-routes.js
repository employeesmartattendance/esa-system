/**
 * ESA Biometric Verification Routes — Server-side face recognition
 *
 * Architecture:
 *   - Browser captures image only
 *   - Sends image to backend for processing
 *   - Backend extracts embedding using @vladmandic/face-api
 *   - Backend compares embeddings (no client-side AI)
 *   - Returns verification result with short-lived token on success
 *
 * Receives: app, models ({ Teacher, School, Settings, BiometricCredential }),
 *           authMiddleware, logAction, sendSuccess, sendError, toId, embedService
 * Returns:  verifyAndConsumeBiometricToken(teacherId, token) — validation helper
 */
const crypto = require('crypto');

// Short-lived token expiration
const TOKEN_TTL_MS = 90 * 1000; // 90 seconds

module.exports = function registerBiometricRoutes(
  app, models, authMiddleware, logAction, sendSuccess, sendError, toId, embedService, biometricImageUpload
) {
  const { Teacher, BiometricCredential } = models;
  const TCH = authMiddleware(['teacher']);
  const SCH = authMiddleware(['school_admin']);
  
  // Image upload middleware (with proper error handling)
  const imageUploadSingle = biometricImageUpload?.single('image') || ((req, res, next) => next());

  // Short-lived, in-memory state for biometric verification tokens
  const verifiedTokens = new Map(); // token -> { teacherId, expiresAt }

  function cleanupExpired(map) {
    const now = Date.now();
    for (const [key, val] of map) if (val.expiresAt < now) map.delete(key);
  }

  async function getTeacherOr404(req, res) {
    const t = await Teacher.findOne({ user_id: req.user._id }).lean();
    if (!t) { sendError(res, 'Employee profile not found', 404); return null; }
    return t;
  }

  // ── 1. Enrollment status ──
  app.get('/api/biometric/status', TCH, async (req, res) => {
    try {
      const t = await getTeacherOr404(req, res); if (!t) return;
      const status = await embedService.getStatus(t._id.toString());
      return sendSuccess(res, status);
    } catch (err) { console.error('Biometric status error:', err); return sendError(res, 'Server error', 500); }
  });

  // ── 2. Enrollment + Verification (server-side face recognition) ──
  // Handles both first-time enrollment and subsequent verification
  app.post('/api/biometric/verify', imageUploadSingle, TCH, async (req, res) => {
    try {
      const t = await getTeacherOr404(req, res); if (!t) return;

      // Expect image as multipart/form-data with field name "image"
      if (!req.file) {
        return sendError(res, 'No image provided', 400);
      }

      const imageBuffer = req.file.buffer;

      // Process via server-side face recognition engine
      const result = await embedService.verifyOrEnroll(
        t._id.toString(),
        t.school_id.toString(),
        imageBuffer
      );

      if (!result.ok) {
        await logAction('BIOMETRIC_VERIFICATION_FAILED', req.user._id, result.message, req.ip);
        return sendError(res, result.message, 401);
      }

      // On success, issue a short-lived verification token
      cleanupExpired(verifiedTokens);
      const token = crypto.randomBytes(24).toString('hex');
      verifiedTokens.set(token, { teacherId: toId(t._id), expiresAt: Date.now() + TOKEN_TTL_MS });

      await logAction('BIOMETRIC_VERIFIED', req.user._id, `Biometric verified (similarity: ${result.similarity})`, req.ip);
      return sendSuccess(res, { verified: true, biometric_token: token, similarity: result.similarity });
    } catch (err) {
      console.error('Biometric verify error:', err);
      return sendError(res, 'Biometric verification failed', 500);
    }
  });

  // ── 3. Employee self-service: remove their own enrollment ──
  app.delete('/api/biometric/self', TCH, async (req, res) => {
    try {
      const t = await getTeacherOr404(req, res); if (!t) return;
      await embedService.resetEnrollment(t._id.toString());
      await logAction('BIOMETRIC_SELF_RESET', req.user._id, 'Employee removed their own biometric enrollment', req.ip);
      return sendSuccess(res, null, 'Biometric enrollment removed — you can set it up again anytime');
    } catch (err) { console.error('Biometric self-remove error:', err); return sendError(res, 'Server error', 500); }
  });

  // ── 4. Admin: reset/revoke an employee's biometric enrollment ──
  app.delete('/api/biometric/credential/:teacherId', SCH, async (req, res) => {
    try {
      const t = await Teacher.findOne({ _id: req.params.teacherId, school_id: req.user.school_id });
      if (!t) return sendError(res, 'Employee not found', 404);
      await embedService.resetEnrollment(t._id.toString());
      await logAction('BIOMETRIC_RESET', req.user._id, `Reset biometric enrollment for employee ${req.params.teacherId}`, req.ip);
      return sendSuccess(res, null, 'Biometric enrollment reset — the employee can enroll again on their device');
    } catch (err) { console.error('Biometric reset error:', err); return sendError(res, 'Server error', 500); }
  });

  console.log('✅ Biometric verification routes registered (server-side face recognition)');

  // ── Consumed by the check-in routes in app.js and mobile-routes.js ──
  return async function verifyAndConsumeBiometricToken(teacherId, token) {
    cleanupExpired(verifiedTokens);
    if (!token) return { ok: false, message: 'Biometric verification is required to check in' };
    const rec = verifiedTokens.get(token);
    if (!rec || rec.teacherId !== toId(teacherId)) return { ok: false, message: 'Biometric verification is missing or expired — please verify again' };
    verifiedTokens.delete(token); // one-time use
    return { ok: true };
  };
};
