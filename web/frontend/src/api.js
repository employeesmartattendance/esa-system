import axios from 'axios'
import { reactive, toRaw } from 'vue'

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
const isLocalhostUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1|\[?::1\]?)(:|\/|$)/i.test(String(url).trim())
const normalizeApiBase = (url) => {
  if (!url) return ''
  const trimmed = String(url).trim().replace(/\/+$/, '')
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`
}

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL
  const runningOnLocalhost = isLocalhostHost(window.location.hostname)
  // A VITE_API_URL pointing at localhost only makes sense when the app itself
  // is being served from localhost. If it's set to localhost while the app is
  // actually deployed (e.g. a stray/leftover env var in the Vercel or Render
  // dashboard), honoring it would make every visitor's browser try to reach
  // their own machine and always fail — so ignore it in that case and fall
  // through to the production defaults below instead.
  if (envUrl && !(isLocalhostUrl(envUrl) && !runningOnLocalhost)) return normalizeApiBase(envUrl)

  const customUrl = localStorage.getItem('esa_backend_url')
  if (customUrl && !(isLocalhostUrl(customUrl) && !runningOnLocalhost)) return normalizeApiBase(customUrl)

  if (isLocalhostHost(window.location.hostname)) return 'https://esa-system.onrender.com/api'
  if (window.location.hostname.endsWith('onrender.com')) return `${window.location.origin.replace(/\/+$/, '')}/api`
  if (window.location.hostname.endsWith('vercel.app')) return DEFAULT_PROD_API_BASE
  if (window.location.hostname.endsWith('esasystem.online')) return DEFAULT_PROD_API_BASE
  return '/api'
}

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: getBaseUrl(),
  // No application-imposed request timeout: real attendance, exports and
  // uploads must be bounded by the user's network, not an arbitrary timer.
  headers: { 'Content-Type': 'application/json' },
})

// ── Persistent cache-first GET layer (IndexedDB + in-memory reactive cache) ──
// Previously visited pages return their last successful payload immediately.
// A quiet request then refreshes IndexedDB and patches the same reactive
// object/array in place, so mounted Vue views update without a loading state.
const CACHE_DB_NAME = 'esa-data-cache-v1'
const CACHE_STORE_NAME = 'responses'
const CACHE_VERSION = 1
const CACHE_FRESH_MS = 0
const memoryCache = new Map()
const refreshInFlight = new Map()
const cacheGeneration = new Map()
let cacheDbPromise = null

function openCacheDb() {
  if (cacheDbPromise) return cacheDbPromise
  cacheDbPromise = new Promise((resolve) => {
    if (!('indexedDB' in window)) return resolve(null)
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
  return cacheDbPromise
}

function idbRequest(mode, action) {
  return openCacheDb().then(db => new Promise(resolve => {
    if (!db) return resolve(null)
    try {
      const tx = db.transaction(CACHE_STORE_NAME, mode)
      const request = action(tx.objectStore(CACHE_STORE_NAME))
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => resolve(null)
      tx.onabort = () => resolve(null)
    } catch { resolve(null) }
  }))
}

const idbGet = key => idbRequest('readonly', store => store.get(key))
const idbPut = entry => idbRequest('readwrite', store => store.put(entry))
const idbDelete = key => idbRequest('readwrite', store => store.delete(key))

function safeUserScope() {
  try {
    const user = JSON.parse(localStorage.getItem('esa_user') || 'null') || {}
    if (!localStorage.getItem('esa_token')) return 'public'
    return [user.role || 'user', user.id ?? user.user_id ?? user.email ?? 'account', user.school_id ?? 'platform'].join(':')
  } catch { return localStorage.getItem('esa_token') ? 'authenticated' : 'public' }
}

function stableValue(value) {
  if (value instanceof URLSearchParams) return value.toString()
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => { out[key] = stableValue(value[key]); return out }, {})
  }
  return value
}

function cacheKeyFor(url, config = {}) {
  const params = config.params ? JSON.stringify(stableValue(config.params)) : ''
  return `${CACHE_DB_NAME}:${safeUserScope()}:${String(url || '')}:${params}`
}

function shouldCacheGet(url, config = {}) {
  if ((config.method || 'get').toLowerCase() !== 'get' || config.responseType && config.responseType !== 'json') return false
  if (config.cache === false || config.noCache === true) return false
  const path = String(url || '').split('?')[0].toLowerCase()
  if (/^\/auth\//.test(path) || /\/(health|status)$/.test(path)) return false
  if (/biometric|hikvision|face-capture|camera-stream|live-location|gps-stream/.test(path)) return false
  if (path === '/teacher/school-location' || path === '/teacher/location') return false
  return true
}

function makeReactive(value) {
  return value && typeof value === 'object' ? reactive(value) : value
}

function patchReactive(target, next) {
  if (Array.isArray(target) && Array.isArray(next)) {
    const replacement = next.map((item, index) => {
      const current = target[index]
      if (Array.isArray(current) && Array.isArray(item)) return patchReactive(current, item)
      if (current && item && typeof current === 'object' && typeof item === 'object' && !Array.isArray(current) && !Array.isArray(item)) return patchReactive(current, item)
      return makeReactive(item)
    })
    target.splice(0, target.length, ...replacement)
    return target
  }
  if (target && next && typeof target === 'object' && typeof next === 'object' && !Array.isArray(target) && !Array.isArray(next)) {
    for (const key of Object.keys(target)) if (!(key in next)) delete target[key]
    for (const [key, value] of Object.entries(next)) {
      const current = target[key]
      if (Array.isArray(current) && Array.isArray(value)) patchReactive(current, value)
      else if (current && value && typeof current === 'object' && typeof value === 'object' && !Array.isArray(current) && !Array.isArray(value)) patchReactive(current, value)
      else target[key] = makeReactive(value)
    }
    return target
  }
  return makeReactive(next)
}

function serializable(value) {
  try { return JSON.parse(JSON.stringify(toRaw(value))) } catch { return null }
}

async function persistCacheEntry(key, value, updatedAt = Date.now()) {
  const plain = serializable(value)
  if (plain === null) return
  await idbPut({ key, value: plain, updatedAt })
}

function currentCacheGeneration(scope) {
  if (!cacheGeneration.has(scope)) cacheGeneration.set(scope, 0)
  return cacheGeneration.get(scope)
}

async function invalidateCurrentScopeCache() {
  const scope = safeUserScope()
  cacheGeneration.set(scope, currentCacheGeneration(scope) + 1)
  const prefix = `${CACHE_DB_NAME}:${scope}:`
  for (const key of memoryCache.keys()) if (key.startsWith(prefix)) memoryCache.delete(key)
  const db = await openCacheDb()
  if (!db) return
  await new Promise(resolve => {
    try {
      const tx = db.transaction(CACHE_STORE_NAME, 'readwrite')
      const store = tx.objectStore(CACHE_STORE_NAME)
      const request = store.openCursor()
      request.onsuccess = () => {
        const cursor = request.result
        if (!cursor) return
        if (String(cursor.key).startsWith(prefix)) cursor.delete()
        cursor.continue()
      }
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve()
    } catch { resolve() }
  })
}

async function refreshCachedGet(url, config, key, originalGet, cachedValue) {
  if (!navigator.onLine || refreshInFlight.has(key)) return
  const scope = safeUserScope()
  const generation = currentCacheGeneration(scope)
  const requestConfig = { ...(config || {}), _esaBackgroundRefresh: true }
  let promise
  promise = originalGet(url, requestConfig).then(async freshValue => {
    if (currentCacheGeneration(scope) !== generation || safeUserScope() !== scope) return
    const updatedValue = patchReactive(cachedValue, freshValue)
    const updatedAt = Date.now()
    memoryCache.set(key, { value: updatedValue, updatedAt })
    void persistCacheEntry(key, updatedValue, updatedAt)
  }).catch(() => { /* Retain the last good cached response; no foreground toast. */ })
    .finally(() => { if (refreshInFlight.get(key) === promise) refreshInFlight.delete(key) })
  refreshInFlight.set(key, promise)
}

function clearApiCache() {
  for (const [scope, generation] of cacheGeneration.entries()) cacheGeneration.set(scope, generation + 1)
  memoryCache.clear()
  refreshInFlight.clear()
  return openCacheDb().then(db => new Promise(resolve => {
    if (!db) return resolve()
    try {
      const tx = db.transaction(CACHE_STORE_NAME, 'readwrite')
      tx.objectStore(CACHE_STORE_NAME).clear()
      tx.oncomplete = tx.onerror = tx.onabort = () => resolve()
    } catch { resolve() }
  }))
}


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
    // Any successful write invalidates the current account's cached reads.
    // This is deliberately conservative: it prevents stale lists/counts after
    // create/edit/delete actions without changing existing mutation flows.
    if (res.config?.method && res.config.method.toLowerCase() !== 'get'
      && !String(res.config.url || '').startsWith('/auth/login')) {
      void invalidateCurrentScopeCache()
    }
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
      if (!config?._esaBackgroundRefresh) dispatchApiError(offlineMsg)
      const fallback = await _offlineFallback(config?.url, method)
      if (fallback !== null) return fallback

      // POST/PUT – queue for background sync
      if (isElectron && !isAuthRequest && (method === 'post' || method === 'put') && config) {
        await db.queueSync(config.url, method, config.data)
        return { success: true, offline_queued: true }
      }

      err.message = offlineMsg
    }

    if (!config?._esaBackgroundRefresh) dispatchApiError(deriveErrorMessage())
    return Promise.reject(err)
  },
)

export default api

// Cache-first wrapper sits on top of the normal Axios interceptors. Cache hits
// resolve immediately; stale entries refresh quietly in the background.
const axiosGet = api.get.bind(api)
api.get = async function cacheFirstGet(url, config = {}) {
  if (!shouldCacheGet(url, config)) return axiosGet(url, config)
  const key = cacheKeyFor(url, config)
  let entry = memoryCache.get(key)
  if (!entry) {
    const persisted = await idbGet(key)
    if (persisted && Object.prototype.hasOwnProperty.call(persisted, 'value')) {
      entry = { value: makeReactive(persisted.value), updatedAt: Number(persisted.updatedAt) || 0 }
      memoryCache.set(key, entry)
    }
  }
  if (entry) {
    if (Date.now() - entry.updatedAt > CACHE_FRESH_MS) {
      void refreshCachedGet(url, config, key, axiosGet, entry.value)
    }
    return entry.value
  }
  const requestScope = safeUserScope()
  const requestGeneration = currentCacheGeneration(requestScope)
  const fresh = await axiosGet(url, config)
  const value = makeReactive(fresh)
  const updatedAt = Date.now()
  // Do not let a GET that started before a successful write repopulate the
  // cache with an older snapshot after that write invalidated the scope.
  if (safeUserScope() === requestScope && currentCacheGeneration(requestScope) === requestGeneration) {
    memoryCache.set(key, { value, updatedAt })
    void persistCacheEntry(key, value, updatedAt)
  }
  return value
}
api.clearCache = clearApiCache

// Warm the IndexedDB connection during app startup without delaying rendering.
void openCacheDb()
