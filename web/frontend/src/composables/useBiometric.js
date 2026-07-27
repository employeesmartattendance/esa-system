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
let modelsLoaded = false

function loadModels() {
  if (modelsLoaded) return Promise.resolve()
  if (!modelsLoadedPromise) {
    console.log('[biometric] Loading face-api.js models from', MODEL_URL)
    modelsLoadedPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]).then(() => {
      modelsLoaded = true
      console.log('[biometric] All models loaded successfully')
    }).catch((err) => {
      // Don't leave a dead rejected promise cached forever — a transient
      // network hiccup shouldn't permanently break face capture for the
      // rest of the session. Clear it so the next call retries the load.
      console.error('[biometric] Model loading failed:', err)
      modelsLoadedPromise = null
      throw err
    })
  }
  return modelsLoadedPromise
}

const isSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)

// Draw the current video frame onto a canvas and return it.
// Passing a canvas to face-api.js is significantly more reliable than passing
// a <video> element because it guarantees the pixel data is actually available —
// video elements can report readyState >= 2 and valid dimensions while still
// delivering empty/stale frames to canvas drawImage in some browsers, but
// calling drawImage forces a synchronous frame grab.
function grabFrame(videoEl, canvasEl) {
  if (!canvasEl) {
    canvasEl = document.createElement('canvas')
  }
  const vw = videoEl.videoWidth || 1
  const vh = videoEl.videoHeight || 1
  canvasEl.width = vw
  canvasEl.height = vh
  const ctx = canvasEl.getContext('2d')
  ctx.drawImage(videoEl, 0, 0, vw, vh)
  return canvasEl
}

// Captures a single face descriptor from a live <video> element that is
// already playing a camera stream. Uses an intermediate canvas for reliable
// frame grab. Returns null if no face is found. Throws a tagged error if
// the detection models themselves failed to load.
async function captureDescriptor(videoEl, canvasEl) {
  if (!videoEl) return null
  // Guard: wait until the video element has real frame data.
  if (videoEl.readyState < 2 || !videoEl.videoWidth) {
    console.log('[biometric] Waiting for video to be ready... readyState:', videoEl.readyState, 'videoWidth:', videoEl.videoWidth)
    await new Promise((resolve) => {
      const check = () => {
        if (videoEl.readyState >= 2 && videoEl.videoWidth) {
          console.log('[biometric] Video ready. readyState:', videoEl.readyState, 'videoWidth:', videoEl.videoWidth, 'videoHeight:', videoEl.videoHeight)
          return resolve()
        }
        requestAnimationFrame(check)
      }
      check()
      setTimeout(resolve, 3000) // increased from 1.5s — some devices are slower
    })
  }
  // Final safety check: if video still has no dimensions after waiting, bail.
  if (!videoEl.videoWidth || !videoEl.videoHeight) {
    console.error('[biometric] Video has no dimensions after waiting — cannot detect face')
    return null
  }
  try {
    await loadModels()
  } catch (e) {
    const err = new Error('Face detection could not start. Check your connection and try again.')
    err.code = 'MODELS_UNAVAILABLE'
    throw err
  }
  // Draw the video frame to a canvas for reliable pixel data access.
  const canvas = grabFrame(videoEl, canvasEl)
  console.log('[biometric] Running face detection on canvas', canvas.width, 'x', canvas.height)
  try {
    const result = await faceapi
      .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
      .withFaceLandmarks()
      .withFaceDescriptor()
    if (!result) {
      console.log('[biometric] No face found in frame')
      return null
    }
    console.log('[biometric] Face detected, descriptor extracted successfully')
    return Array.from(result.descriptor)
  } catch (detErr) {
    // Distinguish detection errors from "no face" so the caller can show
    // a specific message instead of the misleading "no face detected".
    console.error('[biometric] Detection error:', detErr)
    const err = new Error('Face detection encountered an error: ' + (detErr.message || 'unknown'))
    err.code = 'DETECTION_ERROR'
    throw err
  }
}

// Lightweight, landmark-free detection used to drive the live on-screen guide
// (face box + centering hint) while the user positions themselves in frame.
// Cheaper than captureDescriptor() so it can run on a polling interval
// without taxing lower-end devices. Uses a canvas for reliable frame access.
// Returns the detection box (in video pixel space) or null if no face is visible.
async function detectFacePosition(videoEl, canvasEl) {
  if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth || !videoEl.videoHeight) return null
  try {
    await loadModels()
  } catch {
    return null // models not ready yet, retry on next tick
  }
  const canvas = grabFrame(videoEl, canvasEl)
  try {
    const result = await faceapi.detectSingleFace(
      canvas,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 })
    )
    if (!result) return null
    return result.box
  } catch {
    return null // non-fatal for the live guide — retry next tick
  }
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

  return { isSupported, busy, error, enroll, verify, captureDescriptor, detectFacePosition, loadModels, grabFrame }
}
