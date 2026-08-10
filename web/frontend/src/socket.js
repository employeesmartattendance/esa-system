import { io } from 'socket.io-client'

let socket = null

/**
 * Get or initialize the Socket.io client instance.
 * Production Fix: In desktop/mobile, window.location.origin is file://,
 * which will break the socket connection. Use the backend API URL instead.
 */
export function getSocket() {
  if (!socket) {
    const runningOnLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
    const isLocalhostUrl = (url) => /^https?:\/\/(localhost|127\.0\.0\.1|\[?::1\]?)(:|\/|$)/i.test(String(url).trim())

    const envApiUrl = import.meta.env.VITE_API_URL || ''
    const envBase = envApiUrl
      ? envApiUrl.replace(/\/+$/, '').replace(/\/api$/, '')
      : ''
    const savedUrlRaw = localStorage.getItem('esa_backend_url') || '';
    // Ignore an env/saved URL that points at localhost while the app itself
    // is NOT running locally (e.g. a stray dashboard env var) — it would
    // otherwise make every deployed visitor's browser try to reach itself.
    const savedUrl = (savedUrlRaw && !(isLocalhostUrl(savedUrlRaw) && !runningOnLocalhost)) ? savedUrlRaw : ''
    const safeEnvBase = (envBase && !(isLocalhostUrl(envBase) && !runningOnLocalhost)) ? envBase : ''
    const socketUrl = savedUrl || safeEnvBase || window.location.origin;

    // Filter out file:// origin (invalid for Socket.io) and the esasystem.online
    // custom domain (which has no backend of its own — the real backend lives
    // on Render), falling back to the known production backend in both cases.
    const isInvalidOrigin = socketUrl.startsWith('file://') || socketUrl.includes('esasystem.online')
    const finalUrl = isInvalidOrigin ? 'https://esa-system.onrender.com' : socketUrl;

    console.log(`[Socket] Connecting to: ${finalUrl}`);
    
    socket = io(finalUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    })

    socket.on('connect', () => {
      console.log(`[Socket] Connected: ${socket.id}`);
    });

    socket.on('connect_error', (err) => {
      console.error(`[Socket] Connection error: ${err.message}`);
    });
  }
  return socket
}

export function connectSocket(userId, role, schoolId) {
  const s = getSocket()
  if (s.connected) {
    s.emit('join_room', { userId, role, schoolId })
  } else {
    s.once('connect', () => {
      s.emit('join_room', { userId, role, schoolId })
    })
  }
  return s
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
