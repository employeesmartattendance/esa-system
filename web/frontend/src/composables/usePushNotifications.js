// ── Push notifications for employees ────────────────────────────────────────
// Two notification triggers, both driven entirely on-device (no server-side
// push infrastructure required, since ESA runs as a web/webview app):
//
//   1. Proximity  — fires once when the employee's live GPS fix comes within
//      NEAR_RADIUS_METERS of the workplace, so they get a heads-up before
//      they're actually inside the check-in zone.
//   2. Time-based — fires once per day, PRE_ATTENDANCE_MINUTES before the
//      configured "late" cutoff, reminding the employee attendance time is
//      approaching.
//
// Uses the standard browser Notification API. On platforms/browsers where
// it isn't available (or permission is denied), this silently no-ops so it
// never blocks or interferes with check-in/out — notifications are always
// a courtesy layer on top of the core attendance flow, never a requirement.

import { ref } from 'vue'

const NEAR_RADIUS_METERS = 50
const PRE_ATTENDANCE_MINUTES = 20

export function usePushNotifications() {
  const permission = ref(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')

  // Per-tab-session guards so the same event doesn't spam multiple
  // notifications while the employee is still in range / still before the
  // reminder window closes.
  let proximityFiredToday = false
  let attendanceReminderFiredToday = false
  let lastResetDate = new Date().toDateString()

  function resetDailyGuardsIfNewDay() {
    const today = new Date().toDateString()
    if (today !== lastResetDate) {
      lastResetDate = today
      proximityFiredToday = false
      attendanceReminderFiredToday = false
    }
  }

  function isSupported() {
    return typeof window !== 'undefined' && 'Notification' in window
  }

  async function requestPermission() {
    if (!isSupported()) return 'unsupported'
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      permission.value = Notification.permission
      return Notification.permission
    }
    try {
      const result = await Notification.requestPermission()
      permission.value = result
      return result
    } catch {
      return 'denied'
    }
  }

  function fire(title, body, tag) {
    if (!isSupported() || Notification.permission !== 'granted') return
    try {
      // eslint-disable-next-line no-new
      new Notification(title, { body, tag, icon: '/favicon.ico', renotify: false })
    } catch {
      // Some mobile webviews throw on direct `new Notification()` and
      // require a Service Worker registration instead — since this is a
      // best-effort courtesy layer, failures here are swallowed rather
      // than surfaced as errors to the employee.
    }
  }

  /**
   * Call on every GPS fix (lat/lng in decimal degrees) plus the workplace
   * center + radius already used for check-in geofencing. Fires a single
   * "you're near the workplace" notification per day, the first time the
   * employee comes within NEAR_RADIUS_METERS — well inside most check-in
   * radii, so it lands as a helpful heads-up rather than a duplicate of the
   * "you've arrived" auto check-in flow.
   */
  function checkProximity(distanceMeters, { alreadyCheckedIn = false } = {}) {
    resetDailyGuardsIfNewDay()
    if (alreadyCheckedIn) return
    if (proximityFiredToday) return
    if (distanceMeters == null || distanceMeters > NEAR_RADIUS_METERS) return
    proximityFiredToday = true
    fire(
      'Almost there 👋',
      `You're within ${NEAR_RADIUS_METERS}m of your workplace. Check in when you arrive.`,
      'esa-proximity'
    )
  }

  /**
   * Call periodically (e.g. every minute) with the configured late-cutoff
   * time (HH:MM or HH:MM:SS string). Fires once per day, exactly
   * PRE_ATTENDANCE_MINUTES before that cutoff, as long as the employee
   * hasn't already checked in.
   */
  function checkAttendanceReminder(lateThresholdStr, { alreadyCheckedIn = false } = {}) {
    resetDailyGuardsIfNewDay()
    if (alreadyCheckedIn) return
    if (attendanceReminderFiredToday) return
    if (!lateThresholdStr) return

    const [h, m] = lateThresholdStr.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return

    const now = new Date()
    const cutoff = new Date(now)
    cutoff.setHours(h, m, 0, 0)
    const reminderAt = new Date(cutoff.getTime() - PRE_ATTENDANCE_MINUTES * 60000)

    // Fire within a 60s window around the reminder time so a once-a-minute
    // poller reliably catches it without needing sub-minute precision.
    const diff = now.getTime() - reminderAt.getTime()
    if (diff >= 0 && diff < 60000) {
      attendanceReminderFiredToday = true
      fire(
        'Attendance time approaching ⏰',
        `Check-in closes at ${lateThresholdStr.substring(0, 5)} — you have about ${PRE_ATTENDANCE_MINUTES} minutes left.`,
        'esa-attendance-reminder'
      )
    }
  }

  return {
    permission,
    isSupported,
    requestPermission,
    checkProximity,
    checkAttendanceReminder,
    NEAR_RADIUS_METERS,
    PRE_ATTENDANCE_MINUTES,
  }
}
