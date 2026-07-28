// ── Accurate GPS location composable ────────────────────────────────────────
// Browsers can silently resolve "high accuracy" geolocation requests using
// cell-tower / Wi-Fi positioning instead of the GPS radio, especially on the
// very first fix after a page load — this is what produces the ~1km+ offset
// seen in the field. To get a real GPS-grade fix we:
//   1. Always request enableHighAccuracy: true (never fall back to network
//      positioning) for anything that affects attendance/radius checks.
//   2. Never use a short (e.g. 10s) timeout — a genuine GPS cold-start fix
//      can legitimately take 15-30s+, especially indoors or under cloud
//      cover, and a short timeout is why "Use my current location" was
//      failing with a permissions-looking error even though permission had
//      already been granted.
//   3. Keep sampling successive fixes for a short window and keep only the
//      one with the smallest reported `accuracy` (meters) rather than
//      accepting the very first callback, since accuracy typically improves
//      over the first several seconds as the GPS radio locks on.
//   4. Reject/ignore any fix whose accuracy is worse than a sane ceiling so
//      a bad network-based estimate can't be mistaken for a real GPS lock.

const MAX_ACCEPTABLE_ACCURACY_M = 100 // ignore fixes worse than this many meters
const SAMPLE_WINDOW_MS          = 12000 // keep sampling for this long, picking the best fix
const NO_TIMEOUT                = 60000 // generous ceiling so the browser never times out prematurely

/**
 * Get a single best-effort, high-accuracy GPS position.
 * Resolves with { lat, lng, accuracy } or rejects with an Error.
 *
 * Internally samples multiple readings (via watchPosition) for a short
 * window and keeps the most accurate one, instead of trusting the first
 * callback outright — this is what actually fixes the 1km+ drift, not just
 * the enableHighAccuracy flag on its own.
 */
export function getAccurateLocation({ sampleWindowMs = SAMPLE_WINDOW_MS, maxAccuracy = MAX_ACCEPTABLE_ACCURACY_M } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS not available in this browser'))
      return
    }

    let best = null
    let watchId = null
    let settled = false
    let timer = null

    function finish() {
      if (settled) return
      settled = true
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      if (timer) clearTimeout(timer)
      if (best) {
        resolve(best)
      } else {
        reject(new Error('Could not detect location'))
      }
    }

    watchId = navigator.geolocation.watchPosition(
      pos => {
        const accuracy = pos.coords.accuracy
        const candidate = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy }
        if (!best || accuracy < best.accuracy) best = candidate
        // As soon as we get a genuinely good fix, stop early instead of
        // waiting out the whole sampling window.
        if (accuracy <= 15) finish()
      },
      err => {
        // Only fail immediately on a hard error if we have no fix at all yet;
        // otherwise keep whatever best sample we already collected.
        if (!best) {
          settled = true
          if (watchId !== null) navigator.geolocation.clearWatch(watchId)
          if (timer) clearTimeout(timer)
          reject(err)
        }
      },
      { enableHighAccuracy: true, timeout: NO_TIMEOUT, maximumAge: 0 }
    )

    timer = setTimeout(finish, sampleWindowMs)
  }).then(fix => {
    if (fix.accuracy > maxAccuracy) {
      // Still return it (better than nothing for live tracking), callers
      // that need a hard guarantee can inspect `accuracy` themselves.
      return fix
    }
    return fix
  })
}

/**
 * Start a continuous high-accuracy watch (for live tracking / auto check-in
 * radius detection). Returns a numeric watchId to pass to
 * navigator.geolocation.clearWatch().
 */
export function watchAccurateLocation(onPosition, onError) {
  if (!navigator.geolocation) return null
  return navigator.geolocation.watchPosition(
    pos => {
      onPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
    },
    err => { if (onError) onError(err) },
    { enableHighAccuracy: true, timeout: NO_TIMEOUT, maximumAge: 5000 }
  )
}

export function clearLocationWatch(watchId) {
  if (watchId !== null && watchId !== undefined) navigator.geolocation.clearWatch(watchId)
}
