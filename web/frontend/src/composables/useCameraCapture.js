import { ref } from 'vue'
import api from '../api'

/**
 * Lightweight camera capture composable.
 *
 * Handles:
 *   1. Camera permission & stream management
 *   2. Capturing a selfie frame from the video
 *   3. Compressing the image (if needed)
 *   4. Uploading to the backend for CompreFace verification
 *
 * ALL biometric processing happens server-side via CompreFace.
 * The browser never performs face detection or recognition.
 */

const isSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)

export function useCameraCapture() {
  const busy = ref(false)
  const error = ref('')

  /**
   * Request camera permission and return the MediaStream.
   * Throws on denial or unavailability.
   */
  async function requestCamera() {
    if (!isSupported) {
      throw Object.assign(new Error('Camera access is not available on this device or browser.'), { code: 'UNSUPPORTED' })
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    })
    return stream
  }

  /**
   * Capture a single frame from a <video> element as a Blob.
   * Draws to a canvas, exports as JPEG.
   */
  function captureFrame(videoEl, canvasEl) {
    if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) return null

    const w = videoEl.videoWidth
    const h = videoEl.videoHeight

    if (!canvasEl) canvasEl = document.createElement('canvas')
    canvasEl.width = w
    canvasEl.height = h

    const ctx = canvasEl.getContext('2d')
    ctx.drawImage(videoEl, 0, 0, w, h)

    return new Promise((resolve) => {
      canvasEl.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.85,
      )
    })
  }

  /**
   * Compress an image Blob to a target size using canvas.
   * Returns a new Blob. If already small enough, returns the original.
   */
  async function compressImage(blob, maxBytes = 2 * 1024 * 1024) {
    if (blob.size <= maxBytes) return blob

    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        // Scale down proportionally
        const scale = Math.sqrt(maxBytes / blob.size) * 0.9
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((compressed) => resolve(compressed || blob), 'image/jpeg', 0.75)
      }
      img.onerror = () => resolve(blob)
      img.src = URL.createObjectURL(blob)
    })
  }

  /**
   * Upload a captured image to the backend for CompreFace biometric verification.
   * Handles auto-enrollment on first use.
   *
   * @param {Blob} imageBlob - The captured selfie as a JPEG blob
   * @param {string} action - 'checkin' or 'checkout'
   * @returns {{ biometric_token: string, enrolled: boolean, similarity: number }}
   */
  async function verify(imageBlob, action = 'checkin') {
    busy.value = true
    error.value = ''
    try {
      const compressed = await compressImage(imageBlob)
      const formData = new FormData()
      formData.append('image', compressed, 'selfie.jpg')

      const API_BASE = import.meta.env.VITE_API_URL || '/api'
      const baseUrl = API_BASE.replace(/\/api$/, '')

      const response = await fetch(`${baseUrl}/api/biometric/verify?action=${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('esa_token')}`,
        },
        body: formData,
      })

      const data = await response.json()

      if (!data.success) {
        error.value = data.message || 'Verification failed'
        return null
      }

      return data.data // { verified, biometric_token, enrolled, similarity }
    } catch (e) {
      error.value = e?.response?.data?.message || e.message || 'Verification failed'
      return null
    } finally {
      busy.value = false
    }
  }

  /**
   * Check biometric enrollment status from the backend.
   */
  async function getStatus() {
    try {
      return await api.get('/biometric/status')
    } catch {
      return { enrolled: false }
    }
  }

  return { isSupported, busy, error, requestCamera, captureFrame, compressImage, verify, getStatus }
}
