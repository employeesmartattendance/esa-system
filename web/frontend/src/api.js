import axios from 'axios'

/**
 * ESA API Client – Offline-First
 *
 * When running in Electron:
 *   • Online  → call API normally; Electron sync engine saves all data to SQLite
 *   • Offline → return data from local SQLite via IPC (window.electronAPI.dbQuery)
 *
 * When running in browser (no Electron):
 *   • Online  → call API normally
 *   • Offline → return null / empty arrays gracefully
 */

const isElectron = !!window.electronAPI
const DEFAULT_PROD_API_BASE = 'https://esa-system.onrender.com/api'

// ── Base URL resolution ────────────────────────────────────────────────────────
const isLocalhostHost = (host) => ['localhost', '127.0.0.1', '::1'].includes(host)
const normalizeApiBase = (url) => {
  if (!url) return ''
  const trimmed = String(url).trim().replace(/\/+$/, '')
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
}

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) return normalizeApiBase(envUrl)

  const customUrl = localStorage.getItem('esa_backend_url')
  if (customUrl) return normalizeApiBase(customUrl)

  if (isLocalhostHost(window.location.hostname)) return 'https://esa-system.onrender.com/api'
  if (window.location.hostname.endsWith('onrender.com')) return `${window.location.origin.replace(/\/+$/, '')}/api`
  if (window.location.hostname.endsWith('vercel.app')) return DEFAULT_PROD_API_BASE
  return '/api'
}

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// ── SQLite helpers (Electron only) ────────────────────────────────────────────
const db = {
  async query(sql, params = []) {
    if (!isElectron) return { success: false, data: [] }
    return window.electronAPI.dbQuery(sql, params)
  },
  async queueSync(endpoint, method, payload) {
    if (!isElectron) return
    await window.electronAPI.dbQuery(
      'INSERT INTO sync_queue (endpoint, method, payload) VALUES (?, ?, ?)',
      [endpoint, method.toUpperCase(), typeof payload === 'string' ? payload : JSON.stringify(payload)],
    )
  },
}

// ── Offline SQLite data helpers ───────────────────────────────────────────────

async function _offlineFallback(url, method) {
  if (!isElectron) return null
  url = url || ''

  if (method !== 'get') return null

  // -- Teachers
  if (url.includes('/teachers')) {
    const r = await db.query('SELECT * FROM teachers ORDER BY name ASC')
    if (r.success && r.data.length) return r.data
  }
  // -- School settings
  if (url.includes('/school/settings') || url.includes('/settings')) {
    const r = await db.query('SELECT * FROM settings LIMIT 1')
    if (r.success && r.data.length) return r.data[0]
  }
  // -- School stats (build from attendance)
  if (url.includes('/school/stats') || url.includes('/stats')) {
    const today = new Date().toISOString().slice(0, 10)
    const r = await db.query(
      `SELECT
         COUNT(*) AS total_teachers,
         SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present_today,
         SUM(CASE WHEN status='late'    THEN 1 ELSE 0 END) AS late_today,
         SUM(CASE WHEN status='absent'  THEN 1 ELSE 0 END) AS absent_today
       FROM attendance WHERE date = ?`,
      [today],
    )
    if (r.success && r.data.length) return r.data[0]
  }
  // -- Attendance list
  if (url.includes('/attendance')) {
    const r = await db.query('SELECT * FROM attendance ORDER BY date DESC LIMIT 500')
    if (r.success) return r.data
  }
  // -- Reports
  if (url.includes('/reports')) {
    const r = await db.query('SELECT * FROM reports ORDER BY report_date DESC LIMIT 100')
    if (r.success) {
      // Parse JSON name fields
      return r.data.map(rep => ({
        ...rep,
        present_names: _tryParseJson(rep.present_names),
        late_names:    _tryParseJson(rep.late_names),
        absent_names:  _tryParseJson(rep.absent_names),
      }))
    }
  }
  // -- Auth/me (return cached user)
  if (url.includes('/auth/me')) {
    try { return JSON.parse(localStorage.getItem('esa_user') || 'null') } catch { return null }
  }

  return null
}

function _tryParseJson(val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { return JSON.parse(val) } catch { return val }
}

// ── Request interceptor ───────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    config.baseURL = getBaseUrl()
    const token = localStorage.getItem('esa_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    // File uploads (avatars, company/employee photos) use multipart/form-data
    // and can take a while on slow connections or with large images. Don't
    // let the default 15s request timeout abort them — let the upload run
    // to completion (or fail on its own due to a real network error).
    const contentType = config.headers?.['Content-Type'] || config.headers?.['content-type']
    if (contentType && String(contentType).includes('multipart/form-data')) {
      config.timeout = 0
    }
    return config
  },
  (err) => Promise.reject(err),
)

// ── Response interceptor ──────────────────────────────────────────────────────
api.interceptors.response.use(
  (res) => {
    // Unwrap standard ESA envelope { success, data, message }
    const d = res.data
    if (d && typeof d === 'object' && 'success' in d && 'data' in d) return d.data
    return d
  },
  async (err) => {
    const { config, response } = err
    const requestUrl = config?.url || ''
    const method    = (config?.method || 'get').toLowerCase()
    const isOffline = !navigator.onLine || !response || err.code === 'ECONNABORTED'
    const statusCode = response?.status
    const contentType = response?.headers?.['content-type'] || ''
    const isLoginRequest = requestUrl.includes('/auth/login')
    const isPublicAuthRequest = requestUrl.includes('/auth/login')
      || requestUrl.includes('/auth/forgot-password')
      || requestUrl.includes('/auth/verify-reset-otp')
      || requestUrl.includes('/auth/reset-password')
    const isAuthRequest = requestUrl.includes('/auth/')

    const dispatchApiError = (message) => {
      window.dispatchEvent(new CustomEvent('esa:api-error', {
        detail: {
          message,
          url: config?.url || '',
          method,
          status: statusCode || null,
        },
      }))
    }

    const deriveErrorMessage = () => {
      if (contentType.includes('text/html')) {
        return 'Something went wrong on our end. Please try again in a moment.'
      }
      return response?.data?.message || response?.data?.error || err.message || 'Request failed'
    }

    // 401 – session expired
    if (statusCode === 401 && !isPublicAuthRequest) {
      localStorage.removeItem('esa_token')
      localStorage.removeItem('esa_user')
      setTimeout(() => { window.location.href = '/login' }, 1200)
      dispatchApiError('Your session expired. Please sign in again.')
      return Promise.reject(err)
    }

    // Offline or network error → try SQLite
    if (isOffline) {
      const offlineMsg = isLoginRequest
        ? 'We couldn\'t sign you in right now. Please check your internet connection and try again.'
        : 'We\'re having trouble connecting right now. Please check your internet connection and try again.'
      dispatchApiError(offlineMsg)
      const fallback = await _offlineFallback(config?.url, method)
      if (fallback !== null) return fallback

      // POST/PUT – queue for background sync
      if (isElectron && !isAuthRequest && (method === 'post' || method === 'put') && config) {
        await db.queueSync(config.url, method, config.data)
        return { success: true, offline_queued: true }
      }

      err.message = offlineMsg
    }

    dispatchApiError(deriveErrorMessage())
    return Promise.reject(err)
  },
)

export default api
