import { ref } from 'vue'
import * as faceapi from 'face-api.js'
import api from '../api'

// On-device face recognition — captures a live camera frame, runs detection +
// descriptor extraction entirely in the browser via face-api.js, and sends only
// the resulting 128-number descriptor to the server (never a photo or video).
// This replaces the previous WebAuthn-based approach: instead of delegating to
// the device's own Face ID / fingerprint / Windows Hello, we run our own
// capture + matching, so the feature works identically everywhere a camera and
// a browser exist, and enrollment/matching data lives in our own database.
//
// Note: there is no browser API that exposes a fingerprint sensor to a
// webpage — fingerprint-based verification is only reachable through
// platform-native prompts (WebAuthn), which is exactly what this composable
// intentionally moves away from. Face recognition is the biometric factor this
// system implements.
const MODEL_URL = '/models'
let modelsLoadedPromise = null

function loadModels() {
  if (!modelsLoadedPromise) {
    modelsLoadedPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ])
  }
  return modelsLoadedPromise
}

const isSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)

// Captures a single face descriptor from a live <video> element that is
// already playing a camera stream. Returns null if no face (or more than one
// face reliably resolvable) is found in the frame.
async function captureDescriptor(videoEl) {
  await loadModels()
  const result = await faceapi
    .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor()
  if (!result) return null
  return Array.from(result.descriptor)
}

export function useBiometric() {
  const busy = ref(false)
  const error = ref('')

  // Employee self-enrollment. Takes a descriptor already captured via the
  // FaceCaptureModal (camera UI) and stores it as this employee's reference
  // face. Locked server-side to one-time setup — see biometric-routes.js.
  async function enroll(descriptor) {
    busy.value = true
    error.value = ''
    try {
      await api.post('/biometric/register', { descriptor })
      return true
    } catch (e) {
      error.value = e.response?.data?.message || 'Could not set up biometric verification.'
      return false
    } finally {
      busy.value = false
    }
  }

  // Check-in verification. Takes a freshly captured descriptor and compares it
  // server-side against the stored one. Returns a short-lived biometric_token
  // to attach to the check-in request on match, or null on failure/mismatch.
  async function verify(descriptor) {
    busy.value = true
    error.value = ''
    try {
      const result = await api.post('/biometric/verify', { descriptor })
      return result?.biometric_token || null
    } catch (e) {
      error.value = e.response?.data?.message || 'Biometric verification failed.'
      return null
    } finally {
      busy.value = false
    }
  }

  return { isSupported, busy, error, enroll, verify, captureDescriptor, loadModels }
}
