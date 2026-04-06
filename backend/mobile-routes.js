/**
 * ESA Mobile Backend — MongoDB Edition
 * Extends app.js with mobile-specific routes. Backward-compatible.
 *
 * Receives: app, models, authMiddleware, logAction, sendSuccess, sendError,
 *           calcDistance, emitToSchool, io, today, fmtTime, toId
 */
module.exports = function registerMobileRoutes(
  app, models, authMiddleware, logAction,
  sendSuccess, sendError, calcDistance, emitToSchool, io,
  today, fmtTime, toId
) {
  const { Teacher, Attendance, Settings } = models;
  const TCH = authMiddleware(['teacher']);
  const parseBool = (v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v === 1;
    if (typeof v === 'string') {
      const n = v.trim().toLowerCase();
      if (n === 'true' || n === '1' || n === 'yes') return true;
      if (n === 'false' || n === '0' || n === 'no') return false;
    }
    return false;
  };
  const hasFiniteCoordinates = (lat, lng) => Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

  function fmtAtt(a) {
    if (!a) return null;
    const o = a.toObject ? a.toObject() : a;
    return { id: toId(o._id), teacher_id: toId(o.teacher_id), school_id: toId(o.school_id), date: o.date, check_in: fmtTime(o.check_in), check_out: fmtTime(o.check_out), status: o.status, gps_valid: o.gps_valid ? 1 : 0, wifi_valid: o.wifi_valid ? 1 : 0, notes: o.notes || null };
  }

  // ── 1. Mobile version info ──
  app.get('/api/mobile/version', (req, res) => {
    res.json({ success: true, data: { minVersion: '1.0.0', latestVersion: '1.0.0', platform: 'android', forceUpdate: false, message: null } });
  });

  // ── 2. Mobile check-in ──
  app.post('/api/mobile/checkin', TCH, async (req, res) => {
    const { latitude, longitude, auto, offline_timestamp, wifi_connected, wifi_bssid } = req.body;
    try {
      const t = await Teacher.findOne({ user_id: req.user._id }).lean();
      if (!t) return sendError(res, 'Teacher profile not found', 404);

      const td = today();
      const existing = await Attendance.findOne({ teacher_id: t._id, date: td }).lean();
      if (existing) {
        return sendSuccess(res, { ...fmtAtt(existing), date_str: existing.date, check_in_time: fmtTime(existing.check_in), check_out_time: fmtTime(existing.check_out) }, 'Already checked in today');
      }

      const s = await Settings.findOne({ school_id: t.school_id }).lean() || {};
      let gpsValid = true;
      const hasCoords = hasFiniteCoordinates(latitude, longitude);
      if (s.gps_enabled && s.school_lat && s.school_lng) {
        if (!hasCoords) return sendError(res, 'Location is required for GPS validation');
        const dist = calcDistance(parseFloat(latitude), parseFloat(longitude), s.school_lat, s.school_lng);
        gpsValid = dist <= (s.radius || 200);
        if (!gpsValid) return sendError(res, `Outside allowed zone (${Math.round(dist)}m from school)`);
      }
      let wifiValid = false;
      if (s.wifi_enabled) {
        const requireBssid = !!s.wifi_bssid;
        if (requireBssid && typeof wifi_bssid === 'string' && wifi_bssid.trim()) {
          wifiValid = wifi_bssid.trim().toLowerCase() === String(s.wifi_bssid).trim().toLowerCase();
        } else {
          wifiValid = parseBool(wifi_connected);
        }
        if (!wifiValid) return sendError(res, 'Please connect to the school Wi-Fi to mark attendance');
      }

      const checkInTime = offline_timestamp ? new Date(offline_timestamp) : new Date();
      if (Number.isNaN(checkInTime.getTime())) return sendError(res, 'Invalid offline timestamp');
      const checkInDate = checkInTime.toISOString().slice(0, 10);
      const useDate     = checkInDate === td ? checkInDate : td;
      const timeStr     = `${String(checkInTime.getHours()).padStart(2,'0')}:${String(checkInTime.getMinutes()).padStart(2,'0')}`;
      let status = 'present';
      if (timeStr > (s.absent_threshold || '09:00')) status = 'absent';
      else if (timeStr > (s.late_threshold || '08:00')) status = 'late';

      const doc = await Attendance.create({
        teacher_id: t._id, school_id: t.school_id, date: useDate,
        check_in: checkInTime,
        status, gps_valid: gpsValid, wifi_valid: wifiValid,
        check_in_lat: hasCoords ? parseFloat(latitude) : null,
        check_in_lng: hasCoords ? parseFloat(longitude) : null,
        notes: auto ? '[Auto check-in via GPS]' : (offline_timestamp ? '[Offline check-in synced]' : null)
      });

      await logAction('MOBILE_CHECK_IN', req.user._id, `Mobile check-in — status: ${status}`, req.ip);
      emitToSchool(toId(t.school_id), 'attendance_marked', { teacherName: req.user.name, status, action: 'checkin', auto: !!auto, mobile: true, teacherId: toId(t._id) });
      return sendSuccess(res, { ...fmtAtt(doc), date_str: doc.date, id: toId(doc._id) }, 'Checked in successfully', 201);
    } catch (err) { console.error('Mobile checkin error:', err); return sendError(res, 'Server error', 500); }
  });

  // ── 3. Mobile checkout ──
  app.post('/api/mobile/checkout', TCH, async (req, res) => {
    const { auto, offline_timestamp } = req.body;
    try {
      const t = await Teacher.findOne({ user_id: req.user._id }).lean();
      if (!t) return sendError(res, 'Teacher not found', 404);

      const rec = await Attendance.findOne({ teacher_id: t._id, date: today(), check_out: null });
      if (!rec) return sendError(res, 'No active check-in found');

      const checkOutTime = offline_timestamp ? new Date(offline_timestamp) : new Date();
      if (Number.isNaN(checkOutTime.getTime())) return sendError(res, 'Invalid offline timestamp');
      const noteAppend = auto ? ' [Auto checkout - left zone]' : (offline_timestamp ? ' [Offline checkout synced]' : '');
      await Attendance.updateOne({ _id: rec._id }, { check_out: checkOutTime, notes: (rec.notes || '') + noteAppend });

      await logAction('MOBILE_CHECK_OUT', req.user._id, `Mobile check-out${auto?' (auto)':''}`, req.ip);
      emitToSchool(toId(t.school_id), 'attendance_marked', { teacherName: req.user.name, action: 'checkout', auto: !!auto, mobile: true, teacherId: toId(t._id) });
      return sendSuccess(res, null, 'Checked out successfully');
    } catch { return sendError(res, 'Server error', 500); }
  });

  // ── 4. Bulk offline sync ──
  app.post('/api/mobile/sync/bulk', TCH, async (req, res) => {
    const { records } = req.body;
    if (!Array.isArray(records) || !records.length) return sendError(res, 'records array required');

    const t = await Teacher.findOne({ user_id: req.user._id }).lean();
    if (!t) return sendError(res, 'Teacher not found', 404);

    const results = { synced: 0, skipped: 0, errors: 0 };

    for (const record of records.slice(0, 30)) {
      try {
        const date = record.date || today();
        const existing = await Attendance.findOne({ teacher_id: t._id, date });
        if (existing) { results.skipped++; continue; }

        await Attendance.create({
          teacher_id: t._id, school_id: t.school_id, date,
          check_in:   record.check_in   ? new Date(record.check_in)  : null,
          check_out:  record.check_out  ? new Date(record.check_out) : null,
          status:     record.status     || 'present',
          gps_valid:  !!record.gps_valid,
          wifi_valid: !!record.wifi_valid,
          notes: '[Bulk offline sync]'
        });
        results.synced++;
      } catch { results.errors++; }
    }

    await logAction('MOBILE_BULK_SYNC', req.user._id, `Bulk sync: ${results.synced} synced`, req.ip);
    if (results.synced > 0) emitToSchool(toId(t.school_id), 'attendance_marked', { action: 'bulk_sync', count: results.synced, mobile: true });
    return sendSuccess(res, results, `Synced ${results.synced} record(s)`);
  });

  // ── 5. Mobile full profile (includes school settings + location) ──
  app.get('/api/mobile/profile', TCH, async (req, res) => {
    try {
      const t = await Teacher.findOne({ user_id: req.user._id }).populate('school_id', 'name').lean();
      if (!t) return sendError(res, 'Profile not found', 404);
      const s = await Settings.findOne({ school_id: t.school_id }).lean() || {};
      const u = req.user;
      return sendSuccess(res, {
        user:     { id: u.id, name: u.name, email: u.email, phone: u.phone, last_login: u.last_login },
        teacher:  { id: toId(t._id), employee_id: t.employee_id, department: t.department, position: t.position, hire_date: t.hire_date },
        school:   { id: toId(t.school_id?._id || t.school_id), name: t.school_id?.name, lat: s.school_lat || null, lng: s.school_lng || null, radius: s.radius || 200 },
        settings: { gps_enabled: s.gps_enabled, wifi_enabled: s.wifi_enabled, late_threshold: s.late_threshold || '08:00:00', absent_threshold: s.absent_threshold || '09:00:00', checkin_start: s.checkin_start || '06:00:00', checkout_time: s.checkout_time || '17:00:00', work_start: s.work_start || '07:30:00', work_end: s.work_end || '17:00:00' }
      });
    } catch { return sendError(res, 'Server error', 500); }
  });

  console.log('✅ Mobile API routes registered');
};
