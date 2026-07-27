import { ref } from 'vue'
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import api from '../api'

// Wraps WebAuthn (Face ID / fingerprint / Windows Hello / device screen lock)
// enrollment and check-in verification. This goes through the standard browser
// navigator.credentials API, so it works the same whether ESA is running as a
// plain web page, an installed PWA, or wrapped in Capacitor for the mobile app —
// no Capacitor plugin required. The one known edge case is an unusually old
// Android system WebView not supporting WebAuthn yet; isSupported below guards
// against that so the UI can fall back gracefully instead of erroring.
const isSupported = (() => {
  try { return browserSupportsWebAuthn() } catch { return false }
})()

export function useBiometric() {
  const busy = ref(false)
  const error = ref('')

  // Employee self-enrollment — must run on the employee's own device. Returns
  // true on success. Registration can't happen on the admin's behalf: WebAuthn
  // credentials are bound to the secure hardware of whichever device this runs on.
  async function enroll() {
    busy.value = true
    error.value = ''
    try {
      const options = await api.post('/biometric/register/options')
      const attestationResponse = await startRegistration({ optionsJSON: options })
      await api.post('/biometric/register/verify', attestationResponse)
      return true
    } catch (e) {
      error.value = e?.name === 'InvalidStateError'
        ? 'This device is already enrolled.'
        : (e.response?.data?.message || 'Could not set up biometric verification on this device.')
      return false
    } finally {
      busy.value = false
    }
  }

  // Check-in verification — prompts Face ID / fingerprint / whatever the device
  // offers, and on success returns a short-lived biometric_token to attach to the
  // check-in request. Returns null on failure or cancellation (error is set).
  async function verify() {
    busy.value = true
    error.value = ''
    try {
      const options = await api.post('/biometric/auth/options')
      const assertionResponse = await startAuthentication({ optionsJSON: options })
      const result = await api.post('/biometric/auth/verify', assertionResponse)
      return result?.biometric_token || null
    } catch (e) {
      error.value = e?.name === 'NotAllowedError'
        ? 'Verification was cancelled.'
        : (e.response?.data?.message || 'Biometric verification failed.')
      return null
    } finally {
      busy.value = false
    }
  }

  return { isSupported, busy, error, enroll, verify }
}
