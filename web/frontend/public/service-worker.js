/* ESA PWA Service Worker
 * Strategy:
 *  - Precache a minimal app shell (icons, manifest, offline fallback).
 *  - Never intercept /api, /socket.io, /uploads — those must always hit
 *    the network live so the app's real-time / data features keep working.
 *  - Navigation requests: network-first, falling back to cached shell so
 *    the app can still boot when offline.
 *  - Static built assets (JS/CSS/images from /assets/): stale-while-revalidate.
 */

const CACHE_VERSION = 'esa-pwa-v1'
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`

const APP_SHELL_URLS = [
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
]

// Requests to these paths should never be handled by the service worker —
// always go straight to the network so live data / auth / sockets are safe.
const NETWORK_ONLY_PATTERNS = [/^\/api\//, /^\/socket\.io\//, /^\/uploads\//]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .catch(() => {}) // never block install on a caching hiccup
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('esa-pwa-') && key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

function isNetworkOnly(url) {
  return NETWORK_ONLY_PATTERNS.some((re) => re.test(url.pathname))
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (isNetworkOnly(url)) return

  // App navigation (SPA routes) — network-first, cache fallback for offline boot.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put('/index.html', copy)).catch(() => {})
          return response
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || caches.match(request)))
    )
    return
  }

  // Built static assets — stale-while-revalidate.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone()
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
            }
            return response
          })
          .catch(() => cached)
        return cached || networkFetch
      })
    )
  }
})

// Allow the page to trigger immediate activation of a waiting worker
// (used after we detect an update, so users get fixes without a stuck cache).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
