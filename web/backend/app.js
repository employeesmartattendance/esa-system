// ESA BACKEND — MongoDB Edition
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const morgan = require('morgan');
const multer = require('multer');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ── EMAIL TRANSPORTER ──
// Uses Resend HTTP API if RESEND_API_KEY is set (recommended on Render — SMTP ports are blocked).
// Falls back to nodemailer SMTP for local dev or other hosts.

const mailer = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail({ to, subject, html }) {
  const fromName  = process.env.SMTP_FROM_NAME  || 'ESA System';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@esasystem.online';

  // ── Resend HTTP API (works on Render — no SMTP port needed) ──
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('[Mailer] Resend error:', data?.message || JSON.stringify(data));
      } else {
        console.log('[Mailer] Email sent via Resend, id:', data.id);
      }
    } catch (err) {
      console.error('[Mailer] Resend failed:', err.message);
    }
    return;
  }

  // ── Nodemailer SMTP fallback (local dev) ──
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Mailer] No RESEND_API_KEY or SMTP credentials set — email skipped.');
    return;
  }
  try {
    await mailer.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to, subject, html,
    });
    console.log('[Mailer] Email sent via SMTP to:', to);
  } catch (err) {
    console.error('[Mailer] SMTP failed:', err.message);
  }
}

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'esa_secret_key_123';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '30d';
const BACKEND_PUBLIC_URL = (process.env.BACKEND_PUBLIC_URL || '').replace(/\/+$/, '');
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, 'uploads');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
const fallbackOrigins = [
  'https://esasystem.online',
  'http://127.0.0.1:5173',
  'https://esa-system.onrender.com',
];
const allowedOriginSet = new Set([...allowedOrigins, ...fallbackOrigins]);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOriginSet.has(origin)) return true;
  if (allowedOrigins.some((entry) => entry.startsWith('*.') && origin.endsWith(entry.slice(1)))) return true;
  return false;
};

const io = socketIo(server, {
  cors: {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use('/api', apiLimiter);
app.use('/uploads', express.static(UPLOADS_DIR));

['', 'school-logos', 'trusted-logos', 'app-releases'].forEach(d => {
  const p = path.join(UPLOADS_DIR, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});
app.use('/uploads/trusted-logos', express.static(path.join(UPLOADS_DIR, 'trusted-logos')));

const mkStorage = dir => multer.diskStorage({
  destination: (r, f, cb) => cb(null, path.join(UPLOADS_DIR, dir)),
  filename: (r, f, cb) => cb(null, `${dir.split('-')[0]}-${Date.now()}${path.extname(f.originalname)}`)
});
const logoUpload = multer({ storage: mkStorage('school-logos'), limits: { fileSize: 5*1024*1024 } });
const trustedLogoUpload = multer({ storage: mkStorage('trusted-logos'), limits: { fileSize: 5*1024*1024 } });

// ── SCHEMAS ──
const { Schema, Types: { ObjectId } } = mongoose;
const vOpts = { timestamps: true, toJSON: { virtuals: true } };

const SchoolSchema = new Schema({ name: { type: String, required: true }, address: String, phone: String, email: String, status: { type: String, enum: ['active','inactive'], default: 'active' } }, vOpts);
SchoolSchema.index({ status: 1 });

const UserSchema = new Schema({ name: { type: String, required: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, password: { type: String, required: true }, role: { type: String, enum: ['super_admin','school_admin','teacher'], required: true }, school_id: { type: Schema.Types.ObjectId, ref: 'School', default: null }, phone: String, avatar: String, status: { type: String, enum: ['active','inactive'], default: 'active' }, last_login: Date }, vOpts);
UserSchema.index({ role: 1 }); UserSchema.index({ school_id: 1 });

const TeacherSchema = new Schema({ user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, school_id: { type: Schema.Types.ObjectId, ref: 'School', required: true }, employee_id: String, department: String, position: String, hire_date: String, phone: String, subject: String }, vOpts);
TeacherSchema.index({ school_id: 1 });

const SettingsSchema = new Schema({ school_id: { type: Schema.Types.ObjectId, ref: 'School', required: true, unique: true }, school_lat: { type: Number, default: 0 }, school_lng: { type: Number, default: 0 }, radius: { type: Number, default: 200 }, wifi_bssid: String, gps_enabled: { type: Boolean, default: true }, wifi_enabled: { type: Boolean, default: false }, late_threshold: { type: String, default: '08:00:00' }, work_start: { type: String, default: '07:30:00' }, work_end: { type: String, default: '17:00:00' }, absent_threshold: { type: String, default: '09:00:00' }, checkin_start: { type: String, default: '06:00:00' }, checkout_time: { type: String, default: '17:00:00' }, auto_checkout_enabled: { type: Boolean, default: true }, notify_admin_checkout: { type: Boolean, default: true }, allowed_days: { type: [Number], default: [1,2,3,4,5] } }, vOpts);
// school_id already indexed via unique:true in schema field definition

const AttendanceSchema = new Schema({ teacher_id: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true }, school_id: { type: Schema.Types.ObjectId, ref: 'School', required: true }, date: { type: String, required: true }, check_in: Date, check_out: Date, status: { type: String, enum: ['present','late','absent','on_leave'], default: 'absent' }, gps_valid: { type: Boolean, default: false }, wifi_valid: { type: Boolean, default: false }, check_in_lat: Number, check_in_lng: Number, notes: String }, vOpts);
AttendanceSchema.index({ teacher_id: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ school_id: 1, date: 1 });

const LogSchema = new Schema({ action: { type: String, required: true }, user_id: { type: Schema.Types.ObjectId, ref: 'User', default: null }, details: String, ip_address: String, timestamp: { type: Date, default: Date.now } });
LogSchema.index({ user_id: 1, timestamp: -1 });

const TrustedSchoolSchema = new Schema({ name: { type: String, required: true }, logo_url: String, sort_order: { type: Number, default: 0 }, is_active: { type: Boolean, default: true } }, vOpts);
const PasswordResetSchema = new Schema({ email: { type: String, required: true, lowercase: true }, otp_hash: { type: String, required: true }, expires_at: { type: Date, required: true }, used: { type: Boolean, default: false } }, { timestamps: true });
PasswordResetSchema.index({ email: 1 }); PasswordResetSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
const ReportSchema = new Schema({ school_id: { type: Schema.Types.ObjectId, ref: 'School', required: true }, report_date: { type: String, required: true }, total_teachers: { type: Number, default: 0 }, present_count: { type: Number, default: 0 }, late_count: { type: Number, default: 0 }, absent_count: { type: Number, default: 0 }, present_names: [String], late_names: [String], absent_names: [String], generated_at: { type: Date, default: Date.now } }, vOpts);
ReportSchema.index({ school_id: 1, report_date: -1 }, { unique: true });

const ContactSchema = new Schema({ full_name: { type: String, required: true }, email: { type: String, required: true }, phone: String, school_name: String, message: String, status: { type: String, enum: ['pending','approved','rejected'], default: 'pending' }, admin_notes: String }, vOpts);

const School        = mongoose.model('School',        SchoolSchema);
const User          = mongoose.model('User',          UserSchema);
const Teacher       = mongoose.model('Teacher',       TeacherSchema);
const Settings      = mongoose.model('Settings',      SettingsSchema);
const Attendance    = mongoose.model('Attendance',    AttendanceSchema);
const Log           = mongoose.model('Log',           LogSchema);
const TrustedSchool = mongoose.model('TrustedSchool', TrustedSchoolSchema);
const Report        = mongoose.model('Report',        ReportSchema);
const Contact       = mongoose.model('Contact',       ContactSchema);
const PasswordReset = mongoose.model('PasswordReset', PasswordResetSchema);

// ── HELPERS ──
const toId   = v  => v ? v.toString() : null;
const today  = () => new Date().toISOString().slice(0, 10);
const fmtTime = d => { if (!d) return null; const t = new Date(d); return `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`; };
const lean   = doc => { if (!doc) return null; const o = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: true }) : { ...doc }; o.id = toId(o._id); if (o.school_id) o.school_id = toId(o.school_id); return o; };
const leanA  = arr => arr.map(lean);

function fmtAttendance(a) {
  if (!a) return null;
  const o = typeof a.toObject === 'function' ? a.toObject() : a;
  return { id: toId(o._id), teacher_id: toId(o.teacher_id), school_id: toId(o.school_id), date: o.date, check_in: fmtTime(o.check_in), check_out: fmtTime(o.check_out), status: o.status, gps_valid: o.gps_valid ? 1 : 0, wifi_valid: o.wifi_valid ? 1 : 0, notes: o.notes || null };
}

function generateToken(payload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES }); }
function parseBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const n = v.trim().toLowerCase();
    if (n === 'true' || n === '1' || n === 'yes') return true;
    if (n === 'false' || n === '0' || n === 'no') return false;
  }
  if (typeof v === 'number') return v === 1;
  return false;
}
function hasFiniteCoordinates(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}
function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000, dLat = ((lat2-lat1)*Math.PI)/180, dLng = ((lng2-lng1)*Math.PI)/180;
  const a = Math.sin(dLat/2)**2 + Math.cos((lat1*Math.PI)/180)*Math.cos((lat2*Math.PI)/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
async function logAction(action, userId, details, ip) {
  try {
    const log = await Log.create({ action, user_id: userId || null, details: details || null, ip_address: ip || null });
    // Notify super admin dashboard in real-time
    if (io) {
      io.to('super_admin_room').emit('activity_logged', {
        id: log._id.toString(), action, details, timestamp: log.timestamp,
        user_id: userId ? userId.toString() : null,
      });
    }
  } catch (_) {}
}
function sendSuccess(res, data, message = 'Success', code = 200) { return res.status(code).json({ success: true, message, data }); }
function sendError(res, message = 'Error', code = 400) { return res.status(code).json({ success: false, message }); }
function getRequestBaseUrl(req) {
  if (BACKEND_PUBLIC_URL) return BACKEND_PUBLIC_URL;
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString().split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.get('host') || '').toString().split(',')[0].trim();
  return host ? `${proto}://${host}` : '';
}
function toPublicUploadUrl(req, logoUrl) {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) return logoUrl;
  const base = getRequestBaseUrl(req);
  if (!base) return logoUrl;
  return `${base}${logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`}`;
}

// ── PUBLIC HEALTH CHECK ──
app.get('/api/health', async (req, res) => {
  try {
    const dbOk = mongoose.connection.readyState === 1;
    return res.status(200).json({ success: true, data: { api: true, database: dbOk, socket: true } });
  } catch { return res.status(200).json({ success: true, data: { api: true, database: false, socket: true } }); }
});

// ── AUTH MIDDLEWARE ──
function authMiddleware(roles = []) {
  return async (req, res, next) => {
    try {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) return sendError(res, 'No token provided', 401);
      const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
      const user = await User.findOne({ _id: decoded.id, status: 'active' }).lean();
      if (!user) return sendError(res, 'User not found or inactive', 401);
      user.id = toId(user._id); user.school_id = toId(user.school_id);
      if (user.school_id && user.role !== 'super_admin') {
        const school = await School.findById(user.school_id).select('status').lean();
        if (school && school.status === 'inactive') return sendError(res, 'Your school has been deactivated. Please contact the system administrator.', 403);
      }
      if (roles.length && !roles.includes(user.role)) return sendError(res, 'Insufficient permissions', 403);
      req.user = user; next();
    } catch { return sendError(res, 'Invalid or expired token', 401); }
  };
}

// ── SOCKET.IO ──
const connectedUsers = new Map();
const teacherLocations = new Map();
io.on('connection', socket => {
  socket.on('join_room', ({ userId, role, schoolId }) => {
    socket.join(`user_${userId}`);
    if (role === 'super_admin') socket.join('super_admin_room');
    if (schoolId) socket.join(`school_${schoolId}`);
    connectedUsers.set(socket.id, { userId, role, schoolId });
  });
  socket.on('disconnect', () => { connectedUsers.delete(socket.id); });
});
function emitToSchool(schoolId, event, data) { io.to(`school_${schoolId}`).emit(event, data); }
function emitToSuperAdmin(event, data) { io.to('super_admin_room').emit(event, data); }
function forceLogoutSchool(schoolId) { io.to(`school_${schoolId}`).emit('force_logout', { reason: 'school_deactivated', message: 'Your school has been deactivated by the system administrator. You have been signed out.' }); }

// ── AUTH ROUTES ──
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return sendError(res, 'Email and password required');
    const user = await User.findOne({ email: email.toLowerCase().trim() }).lean();
    if (!user) return sendError(res, 'Invalid credentials', 401);
    if (user.status !== 'active') return sendError(res, 'Account is inactive', 401);
    if (user.school_id && user.role !== 'super_admin') {
      const sc = await School.findById(user.school_id).select('status').lean();
      if (sc && sc.status === 'inactive') return sendError(res, 'Your school has been deactivated. Please contact the system administrator.', 403);
    }
    if (!await bcrypt.compare(password, user.password)) return sendError(res, 'Invalid credentials', 401);
    await User.updateOne({ _id: user._id }, { last_login: new Date() });
    await logAction('LOGIN', user._id, `${user.role} logged in`, req.ip);
    const uid = toId(user._id), sid = toId(user.school_id);
    let extra = {};
    if (user.role === 'teacher') {
      const t = await Teacher.findOne({ user_id: user._id }).lean();
      if (t) { const sc = await School.findById(t.school_id).select('name').lean(); extra.teacher = { ...t, id: toId(t._id), user_id: uid, school_id: toId(t.school_id), school_name: sc?.name }; }
    }
    if (user.role === 'school_admin' && user.school_id) { const sc = await School.findById(user.school_id).lean(); if (sc) extra.school = { ...sc, id: toId(sc._id) }; }
    const { password: _, ...safeUser } = user;
    return sendSuccess(res, { token: generateToken({ id: uid, role: user.role, school_id: sid }), user: { ...safeUser, id: uid, school_id: sid, ...extra } }, 'Login successful');
  } catch (err) { console.error(err); return sendError(res, 'Server error', 500); }
});

app.get('/api/auth/me', authMiddleware(), async (req, res) => {
  try {
    const { password: _, ...safe } = req.user;
    let extra = {};
    if (req.user.role === 'teacher') {
      const t = await Teacher.findOne({ user_id: req.user._id }).lean();
      if (t) { const sc = await School.findById(t.school_id).select('name').lean(); extra.teacher = { ...t, id: toId(t._id), user_id: req.user.id, school_id: toId(t.school_id), school_name: sc?.name }; }
    }
    if (req.user.role === 'school_admin' && req.user.school_id) { const sc = await School.findById(req.user.school_id).lean(); if (sc) extra.school = { ...sc, id: toId(sc._id) }; }
    return sendSuccess(res, { ...safe, ...extra });
  } catch { return sendError(res, 'Server error', 500); }
});

app.put('/api/auth/change-password', authMiddleware(), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return sendError(res, 'Both passwords required');
    if (newPassword.length < 6) return sendError(res, 'New password must be at least 6 characters');
    const user = await User.findById(req.user._id).select('password');
    if (!await bcrypt.compare(currentPassword, user.password)) return sendError(res, 'Current password incorrect');
    await User.updateOne({ _id: req.user._id }, { password: await bcrypt.hash(newPassword, 12) });
    return sendSuccess(res, null, 'Password changed successfully');
  } catch { return sendError(res, 'Server error', 500); }
});

app.get('/api/auth/profile', authMiddleware(), async (req, res) => {
  try {
    const u = await User.findById(req.user._id).select('id name email role school_id status created_at').lean();
    return sendSuccess(res, u ? { ...u, id: toId(u._id), school_id: toId(u.school_id) } : null);
  } catch { return sendError(res, 'Server error', 500); }
});

app.put('/api/auth/profile', authMiddleware(), async (req, res) => {
  const { name, newPassword } = req.body;
  if (!name) return sendError(res, 'Name is required');
  try {
    const updates = { name };
    if (newPassword && newPassword.length >= 8) {
      updates.password = await bcrypt.hash(newPassword, 12);
    }
    await User.updateOne({ _id: req.user._id }, updates);
    await logAction('UPDATE_PROFILE', req.user._id, 'Profile updated', req.ip);
    const u = await User.findById(req.user._id).select('id name email role school_id').lean();
    return sendSuccess(res, { ...u, id: toId(u._id) }, 'Profile updated successfully');
  } catch { return sendError(res, 'Server error', 500); }
});

// ── FORGOT PASSWORD OTP FLOW ──
app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return sendError(res, 'Email is required');
  try {
    const user = await User.findOne({ email: email.toLowerCase(), status: 'active' });
    if (!user) return sendSuccess(res, null, 'If that email exists, a code has been sent'); // Don't reveal
    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otp_hash = await bcrypt.hash(otp, 10);
    const expires_at = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    // Invalidate previous resets for this email
    await PasswordReset.deleteMany({ email: email.toLowerCase() });
    await PasswordReset.create({ email: email.toLowerCase(), otp_hash, expires_at });
    await sendEmail({
      to: email.toLowerCase(),
      subject: 'ESA — Your Password Reset Code',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f0f4ff;padding:28px;border-radius:16px">
          <div style="background:linear-gradient(135deg,#2563eb,#06b6d4);border-radius:12px;padding:24px;text-align:center;margin-bottom:20px">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:800">🔐 Password Reset</h1>
            <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:13px">Employee Smart Attendance System</p>
          </div>
          <div style="background:#fff;border-radius:12px;padding:24px;border:1px solid rgba(37,99,235,0.12)">
            <p style="font-size:15px;color:#0f172a;margin:0 0 12px">Hi <strong>${user.name}</strong>,</p>
            <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 20px">Use the code below to reset your ESA password. This code expires in <strong>15 minutes</strong>.</p>
            <div style="background:#f0f4ff;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;border:2px dashed rgba(37,99,235,0.25)">
              <div style="font-size:40px;font-weight:900;letter-spacing:10px;color:#2563eb;font-family:monospace">${otp}</div>
            </div>
            <p style="font-size:12px;color:#94a3b8;margin:0">⚠️ If you did not request this, you can safely ignore this email. Your password will not change.</p>
          </div>
        </div>
      `,
    });
    return sendSuccess(res, null, 'If that email exists, a code has been sent');
  } catch (err) { console.error(err); return sendError(res, 'Server error', 500); }
});

app.post('/api/auth/verify-reset-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return sendError(res, 'Email and OTP are required');
  try {
    const record = await PasswordReset.findOne({ email: email.toLowerCase(), used: false }).sort({ createdAt: -1 });
    if (!record) return sendError(res, 'No reset request found. Please start over.');
    if (record.expires_at < new Date()) return sendError(res, 'Code has expired. Please request a new one.');
    const valid = await bcrypt.compare(otp, record.otp_hash);
    if (!valid) return sendError(res, 'Invalid code. Please check and try again.');
    return sendSuccess(res, null, 'Code verified successfully');
  } catch { return sendError(res, 'Server error', 500); }
});

app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return sendError(res, 'Email, code, and new password are required');
  if (newPassword.length < 8) return sendError(res, 'Password must be at least 8 characters');
  try {
    const record = await PasswordReset.findOne({ email: email.toLowerCase(), used: false }).sort({ createdAt: -1 });
    if (!record) return sendError(res, 'No reset request found. Please start over.');
    if (record.expires_at < new Date()) return sendError(res, 'Code has expired. Please request a new one.');
    const valid = await bcrypt.compare(otp, record.otp_hash);
    if (!valid) return sendError(res, 'Invalid code.');
    const hashed = await bcrypt.hash(newPassword, 12);
    const user = await User.findOneAndUpdate({ email: email.toLowerCase() }, { password: hashed }, { new: true }).lean();
    if (!user) return sendError(res, 'User not found', 404);
    await record.updateOne({ used: true });
    await logAction('RESET_PASSWORD', user._id, 'Password reset via email OTP', null);
    // Auto-login: return a token so frontend can redirect directly
    const uid = toId(user._id), sid = toId(user.school_id);
    const token = generateToken({ id: uid, role: user.role, school_id: sid });
    const { password: _, ...safeUser } = user;
    return sendSuccess(res, { token, user: { ...safeUser, id: uid, school_id: sid } }, 'Password reset successful');
  } catch (err) { console.error(err); return sendError(res, 'Server error', 500); }
});

// ── SUPER ADMIN ──
const SA = authMiddleware(['super_admin']);

app.get('/api/super/stats', SA, async (req, res) => {
  try {
    const [totalSchools, activeSchools, totalTeachers, totalAdmins] = await Promise.all([
      School.countDocuments(), School.countDocuments({ status: 'active' }),
      User.countDocuments({ role: 'teacher' }), User.countDocuments({ role: 'school_admin' })
    ]);
    const td = today();
    const [presentToday, lateToday, absentToday] = await Promise.all([
      Attendance.countDocuments({ date: td, status: 'present' }),
      Attendance.countDocuments({ date: td, status: 'late' }),
      Attendance.countDocuments({ date: td, status: 'absent' })
    ]);
    const recentActivity = await Log.find().sort({ timestamp: -1 }).limit(10).populate('user_id', 'name').lean().then(logs => logs.map(l => ({ ...l, id: toId(l._id), user_name: l.user_id?.name || null })));
    const schools = await School.find().sort({ createdAt: -1 }).limit(10).lean();
    const schoolStats = await Promise.all(schools.map(async s => {
      const sid = s._id;
      const [tc, pt] = await Promise.all([
        User.countDocuments({ school_id: sid, role: 'teacher' }),
        Attendance.countDocuments({ school_id: sid, date: td, status: { $in: ['present','late'] } })
      ]);
      return { id: toId(sid), name: s.name, status: s.status, teacher_count: tc, present_today: pt };
    }));
    return sendSuccess(res, { totalSchools, activeSchools, totalTeachers, totalAdmins, presentToday, lateToday, absentToday, recentActivity, schoolStats });
  } catch (err) { console.error(err); return sendError(res, 'Server error', 500); }
});

async function getSchoolsWithCounts() {
  const schools = await School.find().sort({ createdAt: -1 }).lean();
  return Promise.all(schools.map(async s => {
    const sid = s._id;
    const [tc, ac, ae, an] = await Promise.all([
      User.countDocuments({ school_id: sid, role: 'teacher' }),
      User.countDocuments({ school_id: sid, role: 'school_admin' }),
      User.findOne({ school_id: sid, role: 'school_admin' }).select('email').lean(),
      User.findOne({ school_id: sid, role: 'school_admin' }).select('name').lean()
    ]);
    // Mongoose timestamps use camelCase (createdAt). Expose as created_at for the frontend.
    const td = today();
    const pt = await Attendance.countDocuments({ school_id: sid, date: td, status: { $in: ['present','late'] } });
    return { ...s, id: toId(sid), created_at: s.createdAt, teacher_count: tc, admin_count: ac, admin_email: ae?.email || null, admin_name: an?.name || null, present_today: pt };
  }));
}

app.get('/api/super/schools', SA, async (req, res) => {
  try { return sendSuccess(res, await getSchoolsWithCounts()); } catch { return sendError(res, 'Server error', 500); }
});
app.get('/api/schools', SA, async (req, res) => {
  try { return sendSuccess(res, await getSchoolsWithCounts()); } catch { return sendError(res, 'Server error', 500); }
});

async function createSchool(req, res) {
  const { name, address, phone, email } = req.body;
  // Accept both camelCase (API clients) and snake_case (Vue frontend)
  const adminName     = req.body.adminName     || req.body.admin_name;
  const adminEmail    = req.body.adminEmail    || req.body.admin_email;
  const adminPassword = req.body.adminPassword || req.body.admin_password;
  if (!name || !adminName || !adminEmail || !adminPassword) return sendError(res, 'School name, admin name, email, and password are required');
  if (await User.findOne({ email: adminEmail.toLowerCase() })) return sendError(res, 'Admin email already in use');
  let school;
  try {
    school = await School.create({ name, address: address || null, phone: phone || null, email: email || null });
    await User.create({ name: adminName, email: adminEmail.toLowerCase(), password: await bcrypt.hash(adminPassword, 12), role: 'school_admin', school_id: school._id });
    await Settings.create({ school_id: school._id });
    await logAction('CREATE_SCHOOL', req.user._id, `Created school: ${name}`, req.ip);
    emitToSuperAdmin('school_created', { schoolId: toId(school._id), name });

    // Send welcome email to school admin (non-blocking)
    const loginUrl = process.env.FRONTEND_URL || 'https://esasystem.online';
    sendEmail({
      to: adminEmail.toLowerCase(),
      subject: `Welcome to ESA — Your School Admin Account is Ready`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f0f4ff;padding:32px;border-radius:16px">
          <div style="background:linear-gradient(135deg,#2563eb,#06b6d4);border-radius:12px;padding:28px;text-align:center;margin-bottom:24px">
            <h1 style="color:#fff;margin:0;font-size:28px;font-weight:800">🎓 Welcome to ESA</h1>
            <p style="color:rgba(255,255,255,0.85);margin:8px 0 0">Employee Smart Attendance System</p>
          </div>
          <div style="background:#fff;border-radius:12px;padding:28px;border:1px solid rgba(37,99,235,0.12)">
            <p style="font-size:16px;color:#0f172a;margin:0 0 16px">Hello <strong>${adminName}</strong>,</p>
            <p style="font-size:14px;color:#475569;line-height:1.7;margin:0 0 20px">
              Your school <strong style="color:#2563eb">${name}</strong> has been successfully registered on the ESA platform.
              Your admin account is ready to use.
            </p>
            <div style="background:#f0f4ff;border-radius:10px;padding:20px;margin-bottom:20px;border-left:4px solid #2563eb">
              <p style="margin:0 0 10px;font-weight:700;color:#0f172a;font-size:13px;text-transform:uppercase;letter-spacing:.05em">Your Login Credentials</p>
              <p style="margin:4px 0;font-size:14px;color:#0f172a">📧 <strong>Email:</strong> ${adminEmail.toLowerCase()}</p>
              <p style="margin:4px 0;font-size:14px;color:#0f172a">🔑 <strong>Password:</strong> ${adminPassword}</p>
              <p style="margin:4px 0;font-size:12px;color:#ef4444;margin-top:8px">⚠️ Please change your password after your first login.</p>
            </div>
            <div style="text-align:center;margin:24px 0">
              <a href="${loginUrl}/login" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px">Sign In to Dashboard →</a>
            </div>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />
            <p style="font-size:12px;color:#94a3b8;margin:0">This email was sent by the ESA Super Admin. If you have any questions, please contact your system administrator.</p>
          </div>
        </div>
      `,
    });

    return sendSuccess(res, { schoolId: toId(school._id) }, 'School created successfully', 201);
  } catch (err) {
    // Best-effort cleanup if school was created but subsequent steps failed
    if (school?._id) {
      await School.deleteOne({ _id: school._id }).catch(() => {});
      await User.deleteOne({ school_id: school._id }).catch(() => {});
      await Settings.deleteOne({ school_id: school._id }).catch(() => {});
    }
    console.error(err);
    return sendError(res, err.message || 'Server error', 500);
  }
}
app.post('/api/super/schools', SA, async (req, res) => { try { return await createSchool(req, res); } catch (err) { return sendError(res, err.message || 'Server error', 500); } });
app.post('/api/schools', SA, async (req, res) => { try { return await createSchool(req, res); } catch (err) { return sendError(res, err.message || 'Server error', 500); } });

async function updateSchool(req, res) {
  const { name, address, phone, email, status } = req.body;
  if (!name) return sendError(res, 'School name required');
  await School.updateOne({ _id: req.params.id }, { name, address: address || null, phone: phone || null, email: email || null, status: status || 'active' });
  await logAction('UPDATE_SCHOOL', req.user._id, `Updated school ID: ${req.params.id}`, req.ip);
  emitToSuperAdmin('school_updated', { schoolId: req.params.id });
  return sendSuccess(res, null, 'School updated successfully');
}
app.put('/api/super/schools/:id', SA, async (req, res) => { try { return await updateSchool(req, res); } catch { return sendError(res, 'Server error', 500); } });
app.put('/api/schools/:id', SA, async (req, res) => { try { return await updateSchool(req, res); } catch { return sendError(res, 'Server error', 500); } });

async function deleteSchool(req, res) {
  await School.deleteOne({ _id: req.params.id });
  await logAction('DELETE_SCHOOL', req.user._id, `Deleted school ID: ${req.params.id}`, req.ip);
  emitToSuperAdmin('school_deleted', { schoolId: req.params.id });
  return sendSuccess(res, null, 'School deleted successfully');
}
app.delete('/api/super/schools/:id', SA, async (req, res) => { try { return await deleteSchool(req, res); } catch { return sendError(res, 'Server error', 500); } });
app.delete('/api/schools/:id', SA, async (req, res) => { try { return await deleteSchool(req, res); } catch { return sendError(res, 'Server error', 500); } });

async function toggleSchoolStatus(req, res) {
  const { status } = req.body;
  if (!['active','inactive'].includes(status)) return sendError(res, 'Invalid status');
  await School.updateOne({ _id: req.params.id }, { status });
  await logAction('TOGGLE_SCHOOL_STATUS', req.user._id, `Set school #${req.params.id} to ${status}`, req.ip);
  emitToSuperAdmin('school_status_changed', { schoolId: req.params.id, status });
  if (status === 'inactive') forceLogoutSchool(req.params.id);
  return sendSuccess(res, null, `School ${status}`);
}
app.patch('/api/super/schools/:id/status', SA, async (req, res) => { try { return await toggleSchoolStatus(req, res); } catch { return sendError(res, 'Server error', 500); } });
app.patch('/api/schools/:id/status', SA, async (req, res) => { try { return await toggleSchoolStatus(req, res); } catch { return sendError(res, 'Server error', 500); } });

app.get('/api/super/teachers', SA, async (req, res) => {
  try {
    const teachers = await Teacher.find().populate({ path: 'user_id', select: 'name email status created_at' }).populate({ path: 'school_id', select: 'name' }).lean();
    const result = teachers.filter(t => t.user_id).map(t => ({ id: toId(t.user_id._id), name: t.user_id.name, email: t.user_id.email, status: t.user_id.status, created_at: t.user_id.created_at, school_name: t.school_id?.name, department: t.department, position: t.position, employee_id: t.employee_id }));
    return sendSuccess(res, result);
  } catch { return sendError(res, 'Server error', 500); }
});

app.get('/api/super/attendance/overview', SA, async (req, res) => {
  try {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const agg = await Attendance.aggregate([
      { $match: { date: { $gte: cutoff.toISOString().slice(0,10) } } },
      { $group: { _id: '$date', total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ['$status','present'] }, 1, 0] } }, late: { $sum: { $cond: [{ $eq: ['$status','late'] }, 1, 0] } }, absent: { $sum: { $cond: [{ $eq: ['$status','absent'] }, 1, 0] } } } },
      { $sort: { _id: -1 } }
    ]);
    return sendSuccess(res, agg.map(r => ({ date: r._id, total: r.total, present: r.present, late: r.late, absent: r.absent })));
  } catch { return sendError(res, 'Server error', 500); }
});

app.get('/api/super/admins', SA, async (req, res) => {
  try {
    const admins = await User.find({ role: 'super_admin' }).select('-password').sort({ createdAt: -1 }).lean();
    return sendSuccess(res, admins.map(a => ({ ...a, id: toId(a._id) })));
  } catch { return sendError(res, 'Server error', 500); }
});

app.post('/api/super/admins', SA, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return sendError(res, 'Name, email and password are required');
  if (password.length < 8) return sendError(res, 'Password must be at least 8 characters');
  try {
    if (await User.findOne({ email })) return sendError(res, 'Email already in use');
    const u = await User.create({ name, email, password: await bcrypt.hash(password, 12), role: 'super_admin', status: 'active' });
    await logAction('CREATE_SUPER_ADMIN', req.user._id, `Created super admin: ${name}`, req.ip);
    return sendSuccess(res, { id: toId(u._id), name, email, role: 'super_admin' }, 'Super admin created', 201);
  } catch { return sendError(res, 'Server error', 500); }
});

app.delete('/api/super/admins/:id', SA, async (req, res) => {
  if (req.params.id === req.user.id) return sendError(res, 'You cannot delete your own account');
  try {
    const target = await User.findOne({ _id: req.params.id, role: 'super_admin' });
    if (!target) return sendError(res, 'Super admin not found', 404);
    await User.deleteOne({ _id: req.params.id });
    await logAction('DELETE_SUPER_ADMIN', req.user._id, `Deleted super admin #${req.params.id}`, req.ip);
    return sendSuccess(res, null, 'Admin deleted');
  } catch { return sendError(res, 'Server error', 500); }
});

// ── CONTACT REQUESTS ──
app.get('/api/super/contact-requests', SA, async (req, res) => {
  try { const rows = await Contact.find().sort({ createdAt: -1 }).lean(); return sendSuccess(res, rows.map(r => ({ ...r, id: toId(r._id), created_at: r.createdAt }))); } catch { return sendError(res, 'Server error', 500); }
});
app.put('/api/super/contact-requests/:id', SA, async (req, res) => {
  const { status, admin_notes } = req.body;
  if (!['pending','approved','rejected'].includes(status)) return sendError(res, 'Invalid status');
  try { await Contact.updateOne({ _id: req.params.id }, { status, admin_notes: admin_notes || null }); await logAction('UPDATE_CONTACT_REQUEST', req.user._id, `Set contact request #${req.params.id} to ${status}`, req.ip); return sendSuccess(res, null, 'Contact request updated'); } catch { return sendError(res, 'Server error', 500); }
});
app.delete('/api/super/contact-requests/:id', SA, async (req, res) => {
  try { await Contact.deleteOne({ _id: req.params.id }); await logAction('DELETE_CONTACT_REQUEST', req.user._id, `Deleted contact request #${req.params.id}`, req.ip); return sendSuccess(res, null, 'Contact request deleted'); } catch { return sendError(res, 'Server error', 500); }
});

// ── TRUSTED SCHOOLS ──
app.get('/api/super/trusted-schools', SA, async (req, res) => {
  try {
    const rows = await TrustedSchool.find().sort({ sort_order: 1, _id: 1 }).lean();
    return sendSuccess(res, rows.map(r => ({ ...r, id: toId(r._id), logo_url: toPublicUploadUrl(req, r.logo_url), is_active: r.is_active ? 1 : 0 })));
  } catch { return sendError(res, 'Server error', 500); }
});
app.post('/api/super/trusted-schools', SA, async (req, res) => {
  const { name, logo_url, sort_order, is_active } = req.body;
  if (!name) return sendError(res, 'Name is required');
  try { const r = await TrustedSchool.create({ name, logo_url: logo_url || null, sort_order: parseInt(sort_order) || 0, is_active: is_active !== undefined ? !!is_active : true }); await logAction('CREATE_TRUSTED_SCHOOL', req.user._id, `Created trusted school: ${name}`, req.ip); return sendSuccess(res, { id: toId(r._id) }, 'Trusted school created', 201); } catch { return sendError(res, 'Server error', 500); }
});
app.put('/api/super/trusted-schools/:id', SA, async (req, res) => {
  const { name, logo_url, sort_order, is_active } = req.body;
  if (!name) return sendError(res, 'Name is required');
  try { await TrustedSchool.updateOne({ _id: req.params.id }, { name, logo_url: logo_url || null, sort_order: parseInt(sort_order) || 0, is_active: is_active !== undefined ? !!is_active : true }); await logAction('UPDATE_TRUSTED_SCHOOL', req.user._id, `Updated trusted school #${req.params.id}`, req.ip); return sendSuccess(res, null, 'Trusted school updated'); } catch { return sendError(res, 'Server error', 500); }
});
app.delete('/api/super/trusted-schools/:id', SA, async (req, res) => {
  try { await TrustedSchool.deleteOne({ _id: req.params.id }); await logAction('DELETE_TRUSTED_SCHOOL', req.user._id, `Deleted trusted school #${req.params.id}`, req.ip); return sendSuccess(res, null, 'Trusted school deleted'); } catch { return sendError(res, 'Server error', 500); }
});
app.post('/api/super/trusted-schools/upload-logo', SA, trustedLogoUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return sendError(res, 'No file uploaded');
    const relative_logo_url = `/uploads/trusted-logos/${req.file.filename}`;
    const logo_url = toPublicUploadUrl(req, relative_logo_url);
    return sendSuccess(res, { logo_url, relative_logo_url }, 'Logo uploaded successfully');
  } catch { return sendError(res, 'Server error', 500); }
});

// ── SCHOOL ADMIN ──
const SCH = authMiddleware(['school_admin']);

app.get('/api/school/stats', SCH, async (req, res) => {
  try {
    const sid = req.user.school_id;
    const td = today();
    const [totalTeachers, presentToday, absentToday, lateToday] = await Promise.all([
      User.countDocuments({ school_id: sid, role: 'teacher' }),
      Attendance.countDocuments({ school_id: sid, date: td, status: { $in: ['present','late'] } }),
      Attendance.countDocuments({ school_id: sid, date: td, status: 'absent' }),
      Attendance.countDocuments({ school_id: sid, date: td, status: 'late' })
    ]);
    const cutoff7 = new Date(); cutoff7.setDate(cutoff7.getDate() - 7);
    const weeklyAgg = await Attendance.aggregate([
      { $match: { school_id: new mongoose.Types.ObjectId(sid), date: { $gte: cutoff7.toISOString().slice(0,10) } } },
      { $group: { _id: '$date', present: { $sum: { $cond: [{ $eq: ['$status','present'] }, 1, 0] } }, late: { $sum: { $cond: [{ $eq: ['$status','late'] }, 1, 0] } }, absent: { $sum: { $cond: [{ $eq: ['$status','absent'] }, 1, 0] } } } },
      { $sort: { _id: 1 } }
    ]);
    const weeklyData = weeklyAgg.map(r => ({ date: r._id, present: r.present, late: r.late, absent: r.absent }));
    const recentRaw = await Attendance.find({ school_id: sid, date: td })
      .sort({ check_in: -1 }).limit(10)
      .populate({ path: 'teacher_id', populate: { path: 'user_id', select: 'name' } }).lean();
    const recentAttendance = recentRaw.map(a => ({ id: toId(a._id), teacher_id: toId(a.teacher_id?._id), status: a.status, gps_valid: a.gps_valid ? 1 : 0, wifi_valid: a.wifi_valid ? 1 : 0, date: a.date, check_in: fmtTime(a.check_in), check_out: fmtTime(a.check_out), teacher_name: a.teacher_id?.user_id?.name || null }));
    return sendSuccess(res, { totalTeachers, presentToday, absentToday, lateToday, weeklyData, recentAttendance });
  } catch (err) { console.error(err); return sendError(res, 'Server error', 500); }
});

async function getTeachersForSchool(schoolId) {
  const td = today();
  const teachers = await Teacher.find({ school_id: schoolId }).populate({ path: 'user_id', select: 'name email status last_login created_at phone' }).lean();
  return Promise.all(teachers.filter(t => t.user_id).sort((a,b) => (a.user_id.name||'').localeCompare(b.user_id.name||'')).map(async t => {
    const att = await Attendance.findOne({ teacher_id: t._id, date: td }).lean();
    return { teacher_id: toId(t._id), employee_id: t.employee_id, department: t.department, position: t.position, hire_date: t.hire_date, subject: t.subject, id: toId(t.user_id._id), name: t.user_id.name, email: t.user_id.email, status: t.user_id.status, last_login: t.user_id.last_login, created_at: t.user_id.created_at, phone: t.user_id.phone || t.phone, t_phone: t.phone, today_status: att?.status || null, check_in: fmtTime(att?.check_in) };
  }));
}

app.get('/api/school/teachers', SCH, async (req, res) => {
  try { return sendSuccess(res, await getTeachersForSchool(req.user.school_id)); } catch (err) { console.error(err); return sendError(res, 'Server error', 500); }
});
app.get('/api/teachers', SCH, async (req, res) => {
  try { return sendSuccess(res, await getTeachersForSchool(req.user.school_id)); } catch (err) { console.error(err); return sendError(res, 'Server error', 500); }
});

async function createTeacher(req, res) {
  const { name, email, password, phone, department, position, employeeId, hireDate, subject } = req.body;
  if (!name || !email || !password) return sendError(res, 'Name, email, and password required');
  if (await User.findOne({ email: email.toLowerCase() })) return sendError(res, 'Email already in use');
  let user;
  try {
    user = await User.create({ name, email: email.toLowerCase(), password: await bcrypt.hash(password, 12), role: 'teacher', school_id: req.user.school_id, phone: phone || null });
    await Teacher.create({ user_id: user._id, school_id: req.user.school_id, employee_id: employeeId || null, department: department || null, position: position || null, hire_date: hireDate || null, subject: subject || null });
    await logAction('CREATE_TEACHER', req.user._id, `Created teacher: ${name}`, req.ip);
    emitToSchool(req.user.school_id, 'teacher_updated', { action: 'created', teacherName: name });
    return sendSuccess(res, { userId: toId(user._id) }, 'Teacher created successfully', 201);
  } catch (err) {
    // Best-effort cleanup if user was created but Teacher record creation failed
    if (user?._id) {
      await User.deleteOne({ _id: user._id }).catch(() => {});
    }
    console.error(err);
    return sendError(res, err.message || 'Server error', 500);
  }
}
app.post('/api/school/teachers', SCH, async (req, res) => { try { return await createTeacher(req, res); } catch (err) { return sendError(res, err.message || 'Server error', 500); } });
app.post('/api/teachers', SCH, async (req, res) => { try { return await createTeacher(req, res); } catch (err) { return sendError(res, err.message || 'Server error', 500); } });

async function updateTeacher(req, res) {
  const { name, email, phone, department, position, employeeId, hireDate, subject, status } = req.body;
  const t = await Teacher.findOne({ user_id: req.params.id, school_id: req.user.school_id });
  if (!t) return sendError(res, 'Teacher not found', 404);
  await User.updateOne({ _id: req.params.id }, { name, email: email?.toLowerCase(), phone: phone || null, status: status || 'active' });
  await Teacher.updateOne({ user_id: req.params.id }, { department: department || null, position: position || null, employee_id: employeeId || null, hire_date: hireDate || null, subject: subject || null });
  emitToSchool(req.user.school_id, 'teacher_updated', { action: 'updated', teacherId: req.params.id });
  return sendSuccess(res, null, 'Teacher updated successfully');
}
app.put('/api/school/teachers/:id', SCH, async (req, res) => { try { return await updateTeacher(req, res); } catch { return sendError(res, 'Server error', 500); } });
app.put('/api/teachers/:id', SCH, async (req, res) => { try { return await updateTeacher(req, res); } catch { return sendError(res, 'Server error', 500); } });

async function deleteTeacher(req, res) {
  const t = await Teacher.findOne({ user_id: req.params.id, school_id: req.user.school_id });
  if (!t) return sendError(res, 'Teacher not found', 404);
  await User.deleteOne({ _id: req.params.id });
  emitToSchool(req.user.school_id, 'teacher_updated', { action: 'deleted', teacherId: req.params.id });
  return sendSuccess(res, null, 'Teacher deleted successfully');
}
app.delete('/api/school/teachers/:id', SCH, async (req, res) => { try { return await deleteTeacher(req, res); } catch { return sendError(res, 'Server error', 500); } });
app.delete('/api/teachers/:id', SCH, async (req, res) => { try { return await deleteTeacher(req, res); } catch { return sendError(res, 'Server error', 500); } });

// ── SETTINGS ──
async function getSettings(req, res) {
  try { const s = await Settings.findOne({ school_id: req.user.school_id }).lean(); return sendSuccess(res, s ? { ...s, id: toId(s._id), school_id: toId(s.school_id) } : {}); } catch { return sendError(res, 'Server error', 500); }
}
async function upsertSettings(req, res) {
  try {
    const { school_lat, school_lng, radius, wifi_bssid, gps_enabled, wifi_enabled, late_threshold, work_start, work_end, absent_threshold, checkin_start, checkout_time, auto_checkout_enabled, notify_admin_checkout } = req.body;
    const upd = { school_lat: parseFloat(school_lat)||0, school_lng: parseFloat(school_lng)||0, radius: parseInt(radius)||200, wifi_bssid: wifi_bssid||null, gps_enabled: !!gps_enabled, wifi_enabled: !!wifi_enabled, late_threshold: late_threshold||'08:00:00', work_start: work_start||'07:30:00', work_end: work_end||'17:00:00', absent_threshold: absent_threshold||'09:00:00', checkin_start: checkin_start||'06:00:00', checkout_time: checkout_time||'17:00:00', auto_checkout_enabled: !!auto_checkout_enabled, notify_admin_checkout: !!notify_admin_checkout };
    await Settings.findOneAndUpdate({ school_id: req.user.school_id }, upd, { upsert: true, new: true });
    emitToSchool(req.user.school_id, 'settings_updated', { schoolId: req.user.school_id });
    return sendSuccess(res, null, 'Settings updated successfully');
  } catch (err) { console.error(err); return sendError(res, 'Server error', 500); }
}
app.get('/api/school/settings', SCH, getSettings); app.get('/api/settings', SCH, getSettings);
app.put('/api/school/settings', SCH, upsertSettings); app.post('/api/settings', SCH, upsertSettings);

// ── SCHOOL ATTENDANCE ──
async function getAttendance(req, res) {
  try {
    const { date, teacher_id, status, page = 1, limit = 50 } = req.query;
    const filter = { school_id: req.user.school_id };
    if (date) filter.date = date;
    if (status) filter.status = status;
    const skip = (parseInt(page)-1)*parseInt(limit);
    let teacherFilter = { school_id: req.user.school_id };
    if (teacher_id) teacherFilter._id = teacher_id;
    const tids = (await Teacher.find(teacherFilter).select('_id').lean()).map(t => t._id);
    filter.teacher_id = { $in: tids };
    const records = await Attendance.find(filter).sort({ date: -1, check_in: -1 }).skip(skip).limit(parseInt(limit)).populate({ path: 'teacher_id', populate: { path: 'user_id', select: 'name' } }).lean();
    return sendSuccess(res, records.map(a => ({ ...fmtAttendance(a), teacher_name: a.teacher_id?.user_id?.name || null })));
  } catch (err) { console.error(err); return sendError(res, 'Server error', 500); }
}
app.get('/api/school/attendance', SCH, getAttendance); app.get('/api/attendance', SCH, getAttendance);

app.get('/api/school/analytics', SCH, async (req, res) => {
  try {
    const { period = 'weekly' } = req.query;
    const days = period === 'yearly' ? 365 : period === 'monthly' ? 30 : 7;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const agg = await Attendance.aggregate([
      { $match: { school_id: new mongoose.Types.ObjectId(req.user.school_id), date: { $gte: cutoff.toISOString().slice(0,10) } } },
      { $group: { _id: '$date', present: { $sum: { $cond: [{ $eq: ['$status','present'] }, 1, 0] } }, late: { $sum: { $cond: [{ $eq: ['$status','late'] }, 1, 0] } }, absent: { $sum: { $cond: [{ $eq: ['$status','absent'] }, 1, 0] } } } },
      { $sort: { _id: 1 } }
    ]);
    return sendSuccess(res, agg.map(r => ({ date: r._id, present: r.present, late: r.late, absent: r.absent })));
  } catch { return sendError(res, 'Server error', 500); }
});

// ── TEACHER ROUTES ──
const TCH = authMiddleware(['teacher']);

app.get('/api/teacher/profile', TCH, async (req, res) => {
  try {
    const t = await Teacher.findOne({ user_id: req.user._id }).populate('school_id', 'name').lean();
    if (!t) return sendError(res, 'Profile not found', 404);
    const u = req.user;
    return sendSuccess(res, { id: u.id, name: u.name, email: u.email, phone: u.phone, last_login: u.last_login, teacher_id: toId(t._id), employee_id: t.employee_id, department: t.department, position: t.position, hire_date: t.hire_date, school_name: t.school_id?.name, school_id: toId(t.school_id?._id || t.school_id) });
  } catch { return sendError(res, 'Server error', 500); }
});

app.get('/api/teacher/settings', TCH, async (req, res) => {
  try {
    const t = await Teacher.findOne({ user_id: req.user._id }).lean();
    if (!t) return sendError(res, 'Not found', 404);
    const s = await Settings.findOne({ school_id: t.school_id }).lean();
    if (!s) return sendSuccess(res, {});
    const { wifi_bssid, ...safe } = s;
    return sendSuccess(res, { ...safe, id: toId(s._id), school_id: toId(s.school_id) });
  } catch { return sendError(res, 'Server error', 500); }
});

app.get('/api/teacher/school-location', TCH, async (req, res) => {
  try {
    const t = await Teacher.findOne({ user_id: req.user._id }).lean();
    if (!t) return sendError(res, 'Teacher not found', 404);
    const sc = await School.findById(t.school_id).select('name').lean();
    const s = await Settings.findOne({ school_id: t.school_id }).select('school_lat school_lng radius').lean();
    return sendSuccess(res, { id: toId(t.school_id), name: sc?.name, lat: s?.school_lat || null, lng: s?.school_lng || null, radius: s?.radius || 200 });
  } catch { return sendError(res, 'Server error', 500); }
});

app.post('/api/teacher/location', TCH, async (req, res) => {
  const { latitude, longitude, accuracy } = req.body;
  if (!latitude || !longitude) return sendError(res, 'latitude and longitude required');
  try {
    const t = await Teacher.findOne({ user_id: req.user._id }).lean();
    if (!t) return sendError(res, 'Teacher not found', 404);
    const loc = { teacherId: toId(t._id), teacherName: req.user.name, schoolId: toId(t.school_id), lat: parseFloat(latitude), lng: parseFloat(longitude), accuracy: accuracy ? parseFloat(accuracy) : null, updatedAt: new Date().toISOString() };
    teacherLocations.set(toId(t._id), loc);
    emitToSchool(toId(t.school_id), 'teacher-location-update', loc);
    return sendSuccess(res, loc, 'Location updated');
  } catch { return sendError(res, 'Server error', 500); }
});

app.get('/api/attendance/today', TCH, async (req, res) => {
  try {
    const t = await Teacher.findOne({ user_id: req.user._id }).lean();
    if (!t) return sendSuccess(res, null);
    const a = await Attendance.findOne({ teacher_id: t._id, date: today() }).lean();
    return sendSuccess(res, a ? fmtAttendance({ ...a, toObject: () => a }) : null);
  } catch { return sendError(res, 'Server error', 500); }
});

app.get('/api/attendance/my', TCH, async (req, res) => {
  try {
    const t = await Teacher.findOne({ user_id: req.user._id }).lean();
    if (!t) return sendSuccess(res, []);
    const records = await Attendance.find({ teacher_id: t._id }).sort({ date: -1 }).limit(365).lean();
    return sendSuccess(res, records.map(a => fmtAttendance({ ...a, toObject: () => a })));
  } catch { return sendError(res, 'Server error', 500); }
});

app.post('/api/attendance/checkin', TCH, async (req, res) => {
  const { latitude, longitude, auto, offline_timestamp, wifi_connected, wifi_bssid } = req.body;
  try {
    const t = await Teacher.findOne({ user_id: req.user._id }).lean();
    if (!t) return sendError(res, 'Teacher profile not found', 404);
    const td = today();
    if (await Attendance.findOne({ teacher_id: t._id, date: td })) return sendError(res, 'Already checked in today');
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
    const now = offline_timestamp ? new Date(offline_timestamp) : new Date();
    if (Number.isNaN(now.getTime())) return sendError(res, 'Invalid offline timestamp');
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    let status = 'present';
    if (timeStr > (s.absent_threshold || '09:00')) status = 'absent';
    else if (timeStr > (s.late_threshold || '08:00')) status = 'late';
    await Attendance.create({
      teacher_id: t._id,
      school_id: t.school_id,
      date: td,
      check_in: now,
      status,
      gps_valid: gpsValid,
      wifi_valid: wifiValid,
      check_in_lat: hasCoords ? parseFloat(latitude) : null,
      check_in_lng: hasCoords ? parseFloat(longitude) : null,
      notes: auto ? '[Auto check-in via GPS]' : (offline_timestamp ? '[Offline check-in synced]' : null)
    });
    await logAction('CHECK_IN', req.user._id, `Checked in - status: ${status}${auto?' (auto)':''}`, req.ip);
    emitToSchool(toId(t.school_id), 'attendance_marked', { teacherName: req.user.name, status, action: 'checkin', auto: !!auto, teacherId: toId(t._id) });
    return sendSuccess(res, null, 'Checked in successfully');
  } catch (err) { console.error(err); return sendError(res, 'Server error', 500); }
});

app.post('/api/attendance/checkout', TCH, async (req, res) => {
  try {
    const { auto, offline_timestamp } = req.body;
    const t = await Teacher.findOne({ user_id: req.user._id }).lean();
    if (!t) return sendError(res, 'Teacher not found', 404);
    const rec = await Attendance.findOne({ teacher_id: t._id, date: today(), check_out: null });
    if (!rec) return sendError(res, 'No active check-in found');
    const noteAppend = auto ? ' [Auto checkout - left zone]' : '';
    const checkOutTime = offline_timestamp ? new Date(offline_timestamp) : new Date();
    if (Number.isNaN(checkOutTime.getTime())) return sendError(res, 'Invalid offline timestamp');
    await Attendance.updateOne({ _id: rec._id }, { check_out: checkOutTime, notes: (rec.notes || '') + noteAppend + (offline_timestamp ? ' [Offline checkout synced]' : '') });
    await logAction('CHECK_OUT', req.user._id, `Checked out${auto?' (auto - left zone)':''}`, req.ip);
    emitToSchool(toId(t.school_id), 'attendance_marked', { teacherName: req.user.name, action: 'checkout', auto: !!auto, teacherId: toId(t._id) });
    return sendSuccess(res, null, 'Checked out successfully');
  } catch { return sendError(res, 'Server error', 500); }
});

// ── SCHOOL REPORTS ──
app.get('/api/school/reports', SCH, async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const reports = await Report.find({ school_id: req.user.school_id }).sort({ report_date: -1 }).skip((parseInt(page)-1)*parseInt(limit)).limit(parseInt(limit)).lean();
    return sendSuccess(res, { reports: reports.map(r => ({ ...r, id: toId(r._id), school_id: toId(r.school_id) })) });
  } catch (err) { console.error(err); return sendError(res, 'Server error', 500); }
});

app.post('/api/school/reports/generate', SCH, async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    const cnt = await Attendance.countDocuments({ school_id: schoolId, date: today() });
    if (!cnt) return sendError(res, 'No attendance records for today yet', 400);
    await generateDailyReport(schoolId);
    await logAction('GENERATE_REPORT', req.user._id, `Manually generated daily report for school #${schoolId}`, req.ip);
    return sendSuccess(res, null, "Today's report generated successfully");
  } catch (err) { console.error(err); return sendError(res, 'Server error', 500); }
});

// ── SCHOOL INFO ──
app.get('/api/school/info', authMiddleware(['school_admin','teacher']), async (req, res) => {
  try {
    let schoolId = req.user.school_id;
    if (req.user.role === 'teacher') { const t = await Teacher.findOne({ user_id: req.user._id }).lean(); if (!t) return sendError(res, 'Teacher not found', 404); schoolId = toId(t.school_id); }
    const sc = await School.findById(schoolId).select('id name address phone email').lean();
    return sendSuccess(res, sc ? { ...sc, id: toId(sc._id) } : null);
  } catch { return sendError(res, 'Server error', 500); }
});

// ── AUTO-CHECKOUT TRIGGER ──
app.post('/api/school/auto-checkout/trigger', SCH, async (req, res) => {
  try {
    const schoolId = req.user.school_id;
    const tids = (await Teacher.find({ school_id: schoolId }).select('_id').lean()).map(t => t._id);
    const unchecked = await Attendance.find({ teacher_id: { $in: tids }, date: today(), check_in: { $ne: null }, check_out: null }).populate({ path: 'teacher_id', populate: { path: 'user_id', select: 'name' } }).lean();
    if (!unchecked.length) return sendSuccess(res, { count: 0 }, 'No teachers to auto-checkout');
    for (const rec of unchecked) {
      await Attendance.updateOne({ _id: rec._id }, { check_out: new Date(), notes: (rec.notes || '') + ' [Manual auto-checkout by admin]' });
      await logAction('MANUAL_AUTO_CHECKOUT', req.user._id, `Manual auto-checkout: ${rec.teacher_id?.user_id?.name}`, req.ip);
    }
    emitToSchool(schoolId, 'auto_checkout_complete', { count: unchecked.length });
    return sendSuccess(res, { count: unchecked.length }, `${unchecked.length} teacher(s) checked out`);
  } catch (err) { console.error(err); return sendError(res, 'Server error', 500); }
});

// ── LIVE STATUS & LOCATIONS ──
app.get('/api/school/teachers/live', SCH, async (req, res) => {
  try {
    const td = today();
    const teachers = await Teacher.find({ school_id: req.user.school_id }).populate({ path: 'user_id', select: 'name status', match: { status: 'active' } }).lean();
    const result = await Promise.all(teachers.filter(t => t.user_id).map(async t => {
      const a = await Attendance.findOne({ teacher_id: t._id, date: td }).lean();
      return { id: toId(t.user_id._id), name: t.user_id.name, teacher_id: toId(t._id), status: a?.status || null, check_in: fmtTime(a?.check_in), check_out: fmtTime(a?.check_out), gps_valid: a?.gps_valid ? 1 : 0, wifi_valid: a?.wifi_valid ? 1 : 0 };
    }));
    return sendSuccess(res, result.sort((a,b) => (a.name||'').localeCompare(b.name||'')));
  } catch { return sendError(res, 'Server error', 500); }
});

app.get('/api/school/live-locations', SCH, async (req, res) => {
  try {
    const teachers = await Teacher.find({ school_id: req.user.school_id }).populate('user_id', 'name').lean();
    const locs = teachers.map(t => ({ teacherId: toId(t._id), teacherName: t.user_id?.name, ...(teacherLocations.get(toId(t._id)) || { lat: null, lng: null }) }));
    return sendSuccess(res, locs);
  } catch { return sendError(res, 'Server error', 500); }
});

// ── ATTENDANCE SUMMARY ──
app.get('/api/school/attendance-summary', SCH, async (req, res) => {
  try {
    const sid = req.user.school_id;
    const td = today();
    const cfg = await Settings.findOne({ school_id: sid }).select('checkin_start late_threshold absent_threshold checkout_time').lean();
    const tids = (await Teacher.find({ school_id: sid }).select('_id').lean()).map(t => t._id);
    const agg = await Attendance.aggregate([
      { $match: { teacher_id: { $in: tids }, date: td } },
      { $group: { _id: null, total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ['$status','present'] }, 1, 0] } }, late: { $sum: { $cond: [{ $eq: ['$status','late'] }, 1, 0] } }, absent: { $sum: { $cond: [{ $eq: ['$status','absent'] }, 1, 0] } }, still_in: { $sum: { $cond: [{ $and: [{ $ne: ['$check_in', null] }, { $eq: ['$check_out', null] }] }, 1, 0] } }, checked_out: { $sum: { $cond: [{ $and: [{ $ne: ['$check_in', null] }, { $ne: ['$check_out', null] }] }, 1, 0] } } } }
    ]);
    const checkedInIds = (await Attendance.find({ teacher_id: { $in: tids }, date: td }).select('teacher_id').lean()).map(a => toId(a.teacher_id));
    const notIn = await Teacher.find({ _id: { $in: tids.filter(id => !checkedInIds.includes(toId(id))) } }).populate('user_id', 'name').lean();
    const notCheckedIn = notIn.map(t => ({ teacher_id: toId(t._id), name: t.user_id?.name }));
    const s = agg[0] || { total: 0, present: 0, late: 0, absent: 0, still_in: 0, checked_out: 0 };
    return sendSuccess(res, { ...s, notCheckedIn, settings: { checkin_start: cfg?.checkin_start, late_threshold: cfg?.late_threshold, absent_threshold: cfg?.absent_threshold, checkout_time: cfg?.checkout_time } });
  } catch { return sendError(res, 'Server error', 500); }
});

// ── ATTENDANCE EXPORT ──
app.get('/api/school/attendance/export', SCH, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const tids = (await Teacher.find({ school_id: req.user.school_id }).select('_id').lean()).map(t => t._id);
    const filter = { teacher_id: { $in: tids } };
    if (start_date) filter.date = { ...(filter.date || {}), $gte: start_date };
    if (end_date) filter.date = { ...(filter.date || {}), $lte: end_date };
    const records = await Attendance.find(filter).sort({ date: -1 }).populate({ path: 'teacher_id', populate: { path: 'user_id', select: 'name' } }).lean();
    return sendSuccess(res, records.map(a => ({ date: a.date, teacher_name: a.teacher_id?.user_id?.name, check_in_time: fmtTime(a.check_in), check_out_time: fmtTime(a.check_out), status: a.status, gps_valid: a.gps_valid ? 1 : 0, wifi_valid: a.wifi_valid ? 1 : 0, notes: a.notes })));
  } catch { return sendError(res, 'Server error', 500); }
});

// ── NOTIFICATIONS ──
app.get('/api/notifications', authMiddleware(), async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'school_admin') {
      const schoolUserIds = (await User.find({ school_id: req.user.school_id }).select('_id').lean()).map(u => u._id);
      query = { user_id: { $in: schoolUserIds } };
    } else if (req.user.role === 'teacher') {
      query = { user_id: req.user._id };
    }
    const limit = req.user.role === 'teacher' ? 20 : 30;
    const logs = await Log.find(query).sort({ timestamp: -1 }).limit(limit).populate('user_id', 'name role').lean();
    return sendSuccess(res, logs.map(l => ({ id: toId(l._id), action: l.action, details: l.details, timestamp: l.timestamp, user_name: l.user_id?.name, user_role: l.user_id?.role })));
  } catch { return sendError(res, 'Server error', 500); }
});

// ── LOGS ──
app.get('/api/logs', SA, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 200;
    const logs = await Log.find().sort({ timestamp: -1 }).limit(limit).populate('user_id', 'name role').lean();
    return sendSuccess(res, logs.map(l => ({ ...l, id: toId(l._id), user_name: l.user_id?.name, user_role: l.user_id?.role })));
  } catch { return sendError(res, 'Server error', 500); }
});

// ── WEBSITE PUBLIC ──
app.get('/api/website/schools-count', async (req, res) => {
  try { const [total, active] = await Promise.all([School.countDocuments(), School.countDocuments({ status: 'active' })]); return sendSuccess(res, { total, active }); } catch { return sendError(res, 'Server error', 500); }
});
app.get('/api/website/trusted-schools', async (req, res) => {
  try {
    const rows = await TrustedSchool.find({ is_active: true }).sort({ sort_order: 1, _id: 1 }).lean();
    return sendSuccess(res, rows.map(r => ({ id: toId(r._id), name: r.name, logo_url: toPublicUploadUrl(req, r.logo_url) })));
  } catch { return sendError(res, 'Server error', 500); }
});
app.post('/api/website/contact', async (req, res) => {
  try {
    const { full_name, email, phone, school_name, message } = req.body || {};
    if (!full_name || !email) return sendError(res, 'Name and email are required', 400);
    const normalizedEmail = String(email).trim().toLowerCase();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!emailValid) return sendError(res, 'Please provide a valid email address', 400);
    const r = await Contact.create({ full_name, email: normalizedEmail, phone: phone || null, school_name: school_name || null, message: message || null });
    return sendSuccess(res, { id: toId(r._id) }, 'Request submitted successfully');
  } catch (err) { console.error(err); return sendError(res, 'Server error', 500); }
});

// ── APP DOWNLOADS ──
app.get('/downloads/windows', (req, res) => { const p = path.join(UPLOADS_DIR, 'app-releases', 'esa-setup.exe'); if (!fs.existsSync(p)) return res.status(404).json({ success: false, message: 'Windows installer not yet available. Please contact us to get the app.' }); res.download(p, 'ESA-Setup.exe'); });
app.get('/downloads/mac', (req, res) => { const p = path.join(UPLOADS_DIR, 'app-releases', 'esa-setup.dmg'); if (!fs.existsSync(p)) return res.status(404).json({ success: false, message: 'macOS installer not yet available. Please contact us to get the app.' }); res.download(p, 'ESA-Setup.dmg'); });

// ── REPORT & AUTO-CHECKOUT FUNCTIONS ──
async function generateDailyReport(schoolId) {
  try {
    const td = today();
    const teachers = await Teacher.find({ school_id: schoolId }).populate({ path: 'user_id', select: 'name status', match: { status: 'active' } }).lean();
    const active = teachers.filter(t => t.user_id);
    const attendance = await Attendance.find({ school_id: schoolId, date: td }).lean();
    const attMap = new Map(attendance.map(a => [toId(a.teacher_id), a]));
    const presentList = attendance.filter(a => a.status === 'present').map(a => { const t = active.find(x => toId(x._id) === toId(a.teacher_id)); return t?.user_id?.name || ''; }).filter(Boolean);
    const lateList    = attendance.filter(a => a.status === 'late').map(a => { const t = active.find(x => toId(x._id) === toId(a.teacher_id)); return t?.user_id?.name || ''; }).filter(Boolean);
    const absentList  = active.filter(t => !attMap.has(toId(t._id))).map(t => t.user_id?.name || '').filter(Boolean);
    await Report.findOneAndUpdate({ school_id: schoolId, report_date: td }, { total_teachers: active.length, present_count: presentList.length, late_count: lateList.length, absent_count: absentList.length, present_names: presentList, late_names: lateList, absent_names: absentList, generated_at: new Date() }, { upsert: true, new: true });
    emitToSchool(toId(schoolId), 'report_generated', { schoolId: toId(schoolId), date: td, present: presentList.length, late: lateList.length, absent: absentList.length });
  } catch (err) { console.error('Report generation error for school', schoolId, ':', err.message); }
}

async function runDailyReports() {
  try { const schools = await School.find({ status: 'active' }).lean(); for (const s of schools) await generateDailyReport(s._id); console.log(`✅ Daily reports generated for ${schools.length} school(s)`); }
  catch (err) { console.error('Daily reports error:', err.message); }
}

async function runAutoCheckout() {
  try {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const schools = await School.find({ status: 'active' }).lean();
    for (const school of schools) {
      const cfg = await Settings.findOne({ school_id: school._id, auto_checkout_enabled: true }).lean();
      if (!cfg) continue;
      const checkoutTime = (cfg.checkout_time || '17:00:00').substring(0, 5);
      if (currentTime !== checkoutTime) continue;
      const tids = (await Teacher.find({ school_id: school._id }).select('_id user_id').populate('user_id','name').lean());
      const unchecked = await Attendance.find({ teacher_id: { $in: tids.map(t=>t._id) }, date: today(), check_in: { $ne: null }, check_out: null }).lean();
      for (const rec of unchecked) {
        const t = tids.find(x => toId(x._id) === toId(rec.teacher_id));
        await Attendance.updateOne({ _id: rec._id }, { check_out: now, notes: (rec.notes || '') + ` [Auto checkout at ${checkoutTime}]` });
        await logAction('AUTO_CHECKOUT', null, `Auto checkout: ${t?.user_id?.name} at ${checkoutTime}`, 'system');
      }
      if (unchecked.length && cfg.notify_admin_checkout) emitToSchool(toId(school._id), 'auto_checkout_complete', { count: unchecked.length });
      if (unchecked.length) console.log(`✅ Auto-checkout: ${unchecked.length} teacher(s) at ${school.name}`);
    }
  } catch (err) { console.error('Auto-checkout error:', err.message); }
}

// ── MOBILE ROUTES ──
try {
  const registerMobileRoutes = require('./mobile-routes');
  registerMobileRoutes(app, { Teacher, Attendance, Settings, School, User, Log }, authMiddleware, logAction, sendSuccess, sendError, calcDistance, emitToSchool, io, today, fmtTime, toId);
} catch (err) { console.warn('⚠️  Mobile routes not loaded:', err.message); }

// ── 404 & ERROR HANDLERS ──
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload' });
  }
  if (err?.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'CORS blocked this origin' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── DATABASE & SERVER START ──
async function createSuperAdmin() {
  try {
    const existing = await User.findOne({ role: 'super_admin' });
    if (!existing) {
      await User.create({ name: 'Super Administrator', email: 'superadmin@esa.com', password: await bcrypt.hash('superadmin123', 12), role: 'super_admin', status: 'active' });
      console.log('✅ Super Admin created → Email: superadmin@esa.com | Password: superadmin123');
    } else { console.log('ℹ️  Super Admin already exists'); }
  } catch (err) { console.error('❌ Error creating super admin:', err.message); }
}

async function startServer() {
  const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/esa_db';
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('✅ Connected to MongoDB');
  await createSuperAdmin();
  cron.schedule('59 23 * * *', () => { console.log('🕒 Running daily reports (23:59)...'); runDailyReports(); });
  cron.schedule('30 17 * * *', () => { console.log('🕒 Running afternoon reports (17:30)...'); runDailyReports(); });
  cron.schedule('* * * * *', () => runAutoCheckout());
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 ESA Backend (MongoDB) running on port ${PORT}`);
    console.log(`📡 Socket.io ready`);
    console.log(`🌐 API: http://localhost:${PORT}/api\n`);
  });
}

startServer().catch(err => { console.error('Fatal startup error:', err); process.exit(1); });
