import { io } from 'socket.io-client'

let socket = null

/**
 * Get or initialize the Socket.io client instance.
 * Production Fix: In desktop/mobile, window.location.origin is file://,
 * which will break the socket connection. Use the backend API URL instead.
 */
export function getSocket() {
  if (!socket) {
    const envApiUrl = import.meta.env.VITE_API_URL || ''
    const envBase = envApiUrl
      ? envApiUrl.replace(/\/+$/, '').replace(/\/api$/, '')
      : ''
    const savedUrl = localStorage.getItem('esa_backend_url') || '';
    const socketUrl = savedUrl || envBase || window.location.origin;

    // Filter out file:// origin which is invalid for Socket.io
    const finalUrl = socketUrl.startsWith('file://') ? 'https://esa-system.onrender.com' : socketUrl;

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
