<template>
  <div class="login-page" :class="{ dark: isDark }">
    <div class="bg-mesh"></div>
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>

    <button class="theme-float-btn" @click="toggleDark">
      <AppIcon v-if="isDark" name="sun" :size="18" />
      <AppIcon v-else name="moon" :size="18" />
    </button>

    <div class="login-container">
      <!-- Left branding panel -->
      <div class="login-panel-left">
        <div class="brand">
          <div class="brand-icon">
            <img src="/esa-logo.png" alt="ESA" class="login-logo-img" />
          </div>
          <div>
            <div class="brand-name">ESA</div>
            <div class="brand-sub">Smart Attendance System</div>
          </div>
        </div>

        <div class="left-content">
          <h1>Smart <span class="gradient-text">Attendance</span><br>for Modern Schools</h1>
          <p>Multi-school platform with GPS &amp; Wi-Fi verified check-ins, real-time dashboards, and automated reporting.</p>
          <div class="feature-list">
            <div class="feature-item" v-for="f in features" :key="f.text">
              <div class="feature-icon" :style="`background:${f.bg}`">
                <AppIcon :name="f.icon" :size="16" :color="f.color" />
              </div>
              <span>{{ f.text }}</span>
            </div>
          </div>
        </div>

        <div class="stat-pills">
          <div class="stat-pill" v-for="s in stats" :key="s.label">
            <div class="pill-val">{{ s.val }}</div>
            <div class="pill-label">{{ s.label }}</div>
          </div>
        </div>
      </div>

      <!-- Right form panel -->
      <div class="login-panel-right">
        <div class="login-form-wrap">

          <!-- ── STEP: Login ─────────────────────────────────── -->
          <Transition name="step" mode="out-in">
          <div v-if="step === 'login'" key="login">
            <div class="form-header">
              <h2>Welcome back</h2>
              <p>Sign in to access your dashboard</p>
            </div>
            <div class="role-pills">
              <div
                class="role-pill"
                v-for="r in roles.filter(r => r.key !== 'super_admin')"
                :key="r.key"
                :class="{ active: detectedRole === r.key }"
              >
                <AppIcon :name="r.icon" :size="13" />
                {{ r.label }}
              </div>
            </div>
            <form @submit.prevent="handleLogin" class="login-form">
              <div class="form-group">
                <label class="form-label">Email Address</label>
                <div class="input-wrap">
                  <span class="input-icon"><AppIcon name="user" :size="16" color="var(--text-muted)" /></span>
                  <input v-model="form.email" type="email" class="form-input" placeholder="Enter your email" required autocomplete="email" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Password</label>
                <div class="input-wrap">
                  <span class="input-icon"><AppIcon name="key" :size="16" color="var(--text-muted)" /></span>
                  <input v-model="form.password" :type="showPw ? 'text' : 'password'" class="form-input" placeholder="Enter your password" required autocomplete="current-password" />
                  <button type="button" class="input-toggle" @click="showPw = !showPw">
                    <AppIcon name="eye" :size="15" color="var(--text-muted)" />
                  </button>
                </div>
              </div>
              <div v-if="error" class="form-error">
                <AppIcon name="alert-triangle" :size="15" /><span>{{ error }}</span>
              </div>
              <button type="submit" class="btn-login" :disabled="loading">
                <span v-if="loading" class="btn-spinner"></span>
                <AppIcon v-else name="shield" :size="17" />
                {{ loading ? 'Authenticating...' : 'Sign In Securely' }}
              </button>
              <button type="button" class="btn-forgot" @click="step = 'forgot'; error = ''">
                Forgot your password?
              </button>
            </form>
          </div>

          <!-- ── STEP: Forgot — email entry ──────────────────── -->
          <div v-else-if="step === 'forgot'" key="forgot">
            <button class="step-back" @click="step = 'login'">
              <AppIcon name="filter" :size="14" />Back to login
            </button>
            <div class="form-header" style="margin-top:16px">
              <h2>Reset Password</h2>
              <p>Enter your account email to receive a 6-digit reset code</p>
            </div>
            <form @submit.prevent="sendOtp" class="login-form">
              <div class="form-group">
                <label class="form-label">Email Address</label>
                <div class="input-wrap">
                  <span class="input-icon"><AppIcon name="user" :size="16" color="var(--text-muted)" /></span>
                  <input v-model="fpEmail" type="email" class="form-input" placeholder="Your account email" required autocomplete="email" />
                </div>
              </div>
              <div v-if="error" class="form-error">
                <AppIcon name="alert-triangle" :size="15" /><span>{{ error }}</span>
              </div>
              <button type="submit" class="btn-login" :disabled="loading">
                <span v-if="loading" class="btn-spinner"></span>
                <AppIcon v-else name="bell" :size="17" />
                {{ loading ? 'Sending...' : 'Send Reset Code' }}
              </button>
            </form>
          </div>

          <!-- ── STEP: OTP verification ──────────────────────── -->
          <div v-else-if="step === 'otp'" key="otp">
            <button class="step-back" @click="step = 'forgot'">
              <AppIcon name="filter" :size="14" />Back
            </button>
            <div class="form-header" style="margin-top:16px">
              <h2>Enter the Code</h2>
              <p>A 6-digit code was sent to <strong>{{ fpEmail }}</strong></p>
            </div>
            <form @submit.prevent="verifyOtp" class="login-form">
              <div class="otp-boxes">
                <input
                  v-for="(_, i) in 6"
                  :key="i"
                  :ref="el => { if (el) otpRefs[i] = el }"
                  v-model="otpDigits[i]"
                  maxlength="1"
                  class="otp-box"
                  inputmode="numeric"
                  pattern="[0-9]"
                  @input="onOtpInput(i, $event)"
                  @keydown.backspace="onOtpBack(i, $event)"
                  @paste.prevent="onOtpPaste($event)"
                />
              </div>
              <div v-if="error" class="form-error">
                <AppIcon name="alert-triangle" :size="15" /><span>{{ error }}</span>
              </div>
              <button type="submit" class="btn-login" :disabled="loading || otpDigits.join('').length < 6">
                <span v-if="loading" class="btn-spinner"></span>
                <AppIcon v-else name="check-circle" :size="17" />
                {{ loading ? 'Verifying...' : 'Verify Code' }}
              </button>
              <button type="button" class="btn-forgot" :disabled="resendCooldown > 0" @click="sendOtp">
                {{ resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code' }}
              </button>
            </form>
          </div>

          <!-- ── STEP: New password ──────────────────────────── -->
          <div v-else-if="step === 'reset'" key="reset">
            <div class="form-header">
              <h2>New Password</h2>
              <p>Create a strong password for your account</p>
            </div>
            <form @submit.prevent="resetPassword" class="login-form">
              <div class="form-group">
                <label class="form-label">New Password</label>
                <div class="input-wrap">
                  <span class="input-icon"><AppIcon name="key" :size="16" color="var(--text-muted)" /></span>
                  <input v-model="newPw" :type="showPw ? 'text' : 'password'" class="form-input" placeholder="Min 8 characters" required minlength="8" autocomplete="new-password" />
                  <button type="button" class="input-toggle" @click="showPw = !showPw">
                    <AppIcon name="eye" :size="15" color="var(--text-muted)" />
                  </button>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Confirm Password</label>
                <div class="input-wrap">
                  <span class="input-icon"><AppIcon name="key" :size="16" color="var(--text-muted)" /></span>
                  <input v-model="confirmPw" :type="showPw ? 'text' : 'password'" class="form-input" :class="{ 'input-mismatch': confirmPw && newPw !== confirmPw }" placeholder="Repeat new password" required autocomplete="new-password" />
                </div>
                <span v-if="confirmPw && newPw !== confirmPw" style="font-size:11px;color:var(--danger)">Passwords do not match</span>
              </div>
              <div v-if="error" class="form-error">
                <AppIcon name="alert-triangle" :size="15" /><span>{{ error }}</span>
              </div>
              <button type="submit" class="btn-login" :disabled="loading || (confirmPw && newPw !== confirmPw)">
                <span v-if="loading" class="btn-spinner"></span>
                <AppIcon v-else name="shield" :size="17" />
                {{ loading ? 'Resetting...' : 'Reset & Sign In' }}
              </button>
            </form>
          </div>
          </Transition>

        </div>
        <div class="form-footer">
          <div class="footer-copy">ESA v1.0 · Secured · &copy; {{ new Date().getFullYear() }}</div>
          <a href="#" class="btn-website" @click.prevent="openWebsite">
            <AppIcon name="info" :size="14" color="var(--text-muted)" />
            Visit our site for more information
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useDark } from '../composables/useDark'
import AppIcon from '../components/ui/AppIcon.vue'
import api from '../api'

const router = useRouter()
const auth = useAuthStore()
const { isDark, toggleDark } = useDark()

// ── Login state ──
const form = ref({ email: '', password: '' })
const loading = ref(false)
const error = ref('')
const showPw = ref(false)
const detectedRole = ref('')

// ── Forgot-password multi-step state ──
const step    = ref('login')  // 'login' | 'forgot' | 'otp' | 'reset'
const fpEmail = ref('')
const otpDigits = ref(Array(6).fill(''))
const otpRefs   = ref([])
const newPw     = ref('')
const confirmPw = ref('')
const resendCooldown = ref(0)
let cooldownTimer = null

const WEBSITE_URL = import.meta.env.VITE_WEBSITE_URL || ''
function openWebsite() {
  if (!WEBSITE_URL) return
  window.open(WEBSITE_URL, '_blank', 'noopener,noreferrer')
}

const features = [
  { icon: 'location', text: 'GPS Geofence Verification', bg: 'rgba(37,99,235,0.12)', color: 'var(--primary)' },
  { icon: 'wifi', text: 'Wi-Fi BSSID Validation', bg: 'rgba(6,182,212,0.12)', color: 'var(--accent)' },
  { icon: 'activity', text: 'Real-time Socket.io Updates', bg: 'rgba(16,185,129,0.12)', color: 'var(--success)' },
  { icon: 'layers', text: 'Multi-school Management', bg: 'rgba(139,92,246,0.12)', color: 'var(--info)' },
  { icon: 'bar-chart', text: 'Analytics & CSV Export', bg: 'rgba(245,158,11,0.12)', color: 'var(--warning)' },
]
const stats = [
  { val: '99.9%', label: 'Uptime' },
  { val: '<50ms', label: 'Real-time' },
  { val: 'AES-256', label: 'Encrypted' },
]
const roles = [
  { key: 'super_admin', label: 'Super Admin', icon: 'shield' },
  { key: 'school_admin', label: 'School Admin', icon: 'school' },
  { key: 'teacher', label: 'Teacher', icon: 'user' },
]

// ── Login ──
async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const user = await auth.login(form.value.email, form.value.password)
    if (!user || !user.role) { error.value = 'Login failed — unexpected server response.'; return }
    const routes = { super_admin: '/super/dashboard', school_admin: '/school/dashboard', teacher: '/teacher/dashboard' }
    const dest = routes[user.role]
    if (!dest) { error.value = 'Unknown account role. Please contact your administrator.'; return }
    await router.push(dest)
  } catch (e) {
    error.value = e.message || 'Invalid credentials. Please try again.'
    if (router.currentRoute.value.path !== '/login') await router.replace('/login')
  } finally { loading.value = false }
}

// ── Forgot: Send OTP ──
async function sendOtp() {
  error.value = ''
  loading.value = true
  try {
    await api.post('/auth/forgot-password', { email: fpEmail.value })
    step.value = 'otp'
    otpDigits.value = Array(6).fill('')
    startResendCooldown()
    nextTick(() => otpRefs.value[0]?.focus())
  } catch (e) {
    error.value = e.response?.data?.message || 'Could not send reset code. Check your email.'
  } finally { loading.value = false }
}

function startResendCooldown(secs = 60) {
  resendCooldown.value = secs
  clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    resendCooldown.value--
    if (resendCooldown.value <= 0) clearInterval(cooldownTimer)
  }, 1000)
}

// ── OTP input handling ──
function onOtpInput(i, e) {
  const val = e.target.value.replace(/\D/g, '').slice(-1)
  otpDigits.value[i] = val
  if (val && i < 5) nextTick(() => otpRefs.value[i + 1]?.focus())
}
function onOtpBack(i, e) {
  if (!otpDigits.value[i] && i > 0) {
    otpDigits.value[i - 1] = ''
    nextTick(() => otpRefs.value[i - 1]?.focus())
  }
}
function onOtpPaste(e) {
  const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
  text.split('').forEach((ch, i) => { otpDigits.value[i] = ch })
  nextTick(() => otpRefs.value[Math.min(text.length, 5)]?.focus())
}

// ── OTP: Verify ──
async function verifyOtp() {
  error.value = ''
  loading.value = true
  try {
    await api.post('/auth/verify-reset-otp', { email: fpEmail.value, otp: otpDigits.value.join('') })
    step.value = 'reset'
  } catch (e) {
    error.value = e.response?.data?.message || 'Invalid or expired code.'
  } finally { loading.value = false }
}

// ── Reset: Set new password + auto-login ──
async function resetPassword() {
  error.value = ''
  if (newPw.value !== confirmPw.value) { error.value = 'Passwords do not match'; return }
  loading.value = true
  try {
    const res = await api.post('/auth/reset-password', {
      email: fpEmail.value,
      otp: otpDigits.value.join(''),
      newPassword: newPw.value,
    })
    // Backend returns { token, user } → auto-login
    const payload = res?.data || res
    const t = payload?.token
    const u = payload?.user
    if (t && u) {
      auth.token     = t; auth.user = u; auth.loginTime = Date.now()
      localStorage.setItem('esa_token', t)
      localStorage.setItem('esa_user', JSON.stringify(u))
      localStorage.setItem('esa_login_time', String(Date.now()))
      const routes = { super_admin: '/super/dashboard', school_admin: '/school/dashboard', teacher: '/teacher/dashboard' }
      await router.push(routes[u.role] || '/login')
    } else {
      step.value = 'login'
      error.value = ''
    }
  } catch (e) {
    error.value = e.response?.data?.message || 'Failed to reset password. Please start over.'
  } finally { loading.value = false }
}
</script>


<style scoped>
.login-page { min-height: 100vh; display: flex; align-items: stretch; background: var(--bg); position: relative; overflow-y: auto; overflow-x: hidden; scrollbar-width: none; -ms-overflow-style: none; }
.login-page::-webkit-scrollbar { display: none; }
@media (max-height: 700px) {
  .login-page { scrollbar-width: thin; }
  .login-page::-webkit-scrollbar { display: block; width: 4px; }
  .login-page::-webkit-scrollbar-thumb { background: var(--primary); border-radius: 99px; }
}
.orb { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; }
.orb-1 { width: 600px; height: 600px; background: rgba(37,99,235,0.15); top: -200px; left: -100px; }
.orb-2 { width: 400px; height: 400px; background: rgba(6,182,212,0.1); bottom: -100px; right: 200px; }
.orb-3 { width: 300px; height: 300px; background: rgba(139,92,246,0.1); top: 50%; left: 30%; }
.theme-float-btn { position: fixed; top: 20px; right: 20px; z-index: 10; width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--surface-border); background: var(--surface); backdrop-filter: blur(12px); color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all var(--transition); }
.theme-float-btn:hover { color: var(--primary); border-color: var(--primary); }
.login-container { display: flex; width: 100%; max-width: 1100px; margin: auto; min-height: 100vh; position: relative; z-index: 1; }
.login-panel-left { flex: 1.1; padding: 48px 52px; display: flex; flex-direction: column; border-right: 1px solid var(--surface-border); background: linear-gradient(150deg, rgba(37,99,235,0.06) 0%, rgba(6,182,212,0.03) 100%); }
.brand { display: flex; align-items: center; gap: 12px; margin-bottom: 60px; }
.brand-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.login-logo-img { width: 48px; height: 48px; object-fit: contain; border-radius: 12px; }
.brand-name { font-size: 22px; font-weight: 800; }
.brand-sub { font-size: 11px; color: var(--text-muted); font-weight: 500; }
.left-content { flex: 1; }
.left-content h1 { font-size: 38px; font-weight: 800; line-height: 1.15; margin-bottom: 16px; }
.gradient-text { background: linear-gradient(135deg, var(--primary), var(--accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.left-content p { font-size: 15px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 36px; max-width: 380px; }
.feature-list { display: flex; flex-direction: column; gap: 14px; }
.feature-item { display: flex; align-items: center; gap: 12px; font-size: 14px; font-weight: 500; color: var(--text-secondary); }
.feature-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-pills { display: flex; gap: 12px; margin-top: 48px; }
.stat-pill { flex: 1; padding: 14px; background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius); text-align: center; backdrop-filter: blur(12px); }
.pill-val { font-size: 18px; font-weight: 800; color: var(--primary); }
.pill-label { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.login-panel-right { flex: 0.9; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 52px; }
.login-form-wrap { width: 100%; max-width: 380px; }
.form-header { margin-bottom: 28px; }
.form-header h2 { font-size: 28px; font-weight: 800; margin-bottom: 6px; }
.form-header p { font-size: 14px; color: var(--text-muted); }
.role-pills { display: flex; gap: 6px; margin-bottom: 28px; padding: 5px; background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-sm); }
.role-pill { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 6px 4px; border-radius: 6px; font-size: 11px; font-weight: 600; color: var(--text-muted); transition: all var(--transition); }
.role-pill.active { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: #fff; box-shadow: 0 4px 12px var(--primary-glow); }
.login-form { display: flex; flex-direction: column; gap: 18px; }
.form-group { display: flex; flex-direction: column; gap: 7px; }
.form-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-secondary); }
.input-wrap { position: relative; display: flex; align-items: center; }
.input-icon { position: absolute; left: 13px; display: flex; pointer-events: none; }
.form-input { width: 100%; padding: 12px 14px 12px 40px; background: var(--surface); border: 1.5px solid var(--surface-border); border-radius: var(--radius-sm); color: var(--text); font-size: 14px; font-family: var(--font); transition: all var(--transition); }
.form-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-glow); }
.form-input::placeholder { color: var(--text-muted); }
.input-toggle { position: absolute; right: 12px; background: transparent; border: none; cursor: pointer; display: flex; align-items: center; padding: 4px; }
.form-error { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-radius: var(--radius-sm); background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); color: var(--danger); font-size: 13px; font-weight: 500; }
.btn-login { width: 100%; padding: 13px; background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: #fff; border: none; border-radius: var(--radius-sm); font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all var(--transition); box-shadow: 0 4px 20px var(--primary-glow); font-family: var(--font); }
.btn-login:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 8px 28px var(--primary-glow); }
.btn-login:disabled { opacity: 0.7; cursor: not-allowed; }
.btn-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
.demo-hint { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); justify-content: center; }
.demo-hint strong { color: var(--text-secondary); }
.form-footer { margin-top: 32px; font-size: 12px; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 10px; }
.footer-copy { font-size: 12px; color: var(--text-muted); }
.btn-website {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 20px; border-radius: var(--radius-sm);
  border: 1.5px solid var(--surface-border); background: transparent;
  color: var(--text-muted); font-size: 13px; font-weight: 600;
  font-family: var(--font); cursor: pointer;
  transition: all var(--transition); text-decoration: none;
}
.btn-website:hover { border-color: var(--primary); color: var(--primary); background: rgba(37,99,235,0.06); }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 900px) { .login-panel-left { display: none; } .login-panel-right { flex: 1; padding: 32px 24px; } }

/* ── Forgot password buttons ── */
.btn-forgot {
  width: 100%; background: none; border: none; cursor: pointer;
  font-size: 13px; color: var(--primary); font-weight: 600;
  padding: 8px; text-align: center; transition: opacity 0.2s;
  font-family: var(--font);
}
.btn-forgot:hover { opacity: 0.75; }
.btn-forgot:disabled { opacity: 0.4; cursor: not-allowed; }

.step-back {
  display: inline-flex; align-items: center; gap: 6px;
  background: none; border: none; cursor: pointer;
  font-size: 13px; color: var(--text-muted); font-weight: 600;
  padding: 4px 0; font-family: var(--font);
  transition: color 0.2s;
}
.step-back:hover { color: var(--primary); }

/* ── OTP boxes ── */
.otp-boxes {
  display: flex; gap: 8px; justify-content: center;
}
.otp-box {
  width: 48px; height: 56px; border-radius: var(--radius-sm);
  border: 2px solid var(--surface-border); background: var(--surface);
  color: var(--text); font-size: 22px; font-weight: 800;
  text-align: center; font-family: var(--mono);
  transition: all 0.2s; caret-color: var(--primary);
}
.otp-box:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-glow); }

/* ── Input mismatch ── */
.input-mismatch { border-color: var(--danger) !important; }

/* ── Step transitions ── */
.step-enter-active, .step-leave-active { transition: all 0.22s ease; }
.step-enter-from { opacity: 0; transform: translateX(20px); }
.step-leave-to   { opacity: 0; transform: translateX(-20px); }

</style>
