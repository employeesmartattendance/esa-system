import { ref } from 'vue'
import api from '../api'

// Server-side face recognition with InsightFace
// 
// Frontend responsibilities:
//   - Request camera permission
//   - Capture image
//   - Upload image to backend
//   - Display results
//
// Backend responsibilities:
//   - Face detection
//   - Embedding extraction
//   - Face verification
//   - Similarity matching
//
// This removes all client-side AI processing and model downloads.

const isSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)

// Capture image from video element and return as blob
function captureImageFromVideo(videoEl) {
  if (!videoEl) return null
  const canvas = document.createElement('canvas')
  const vw = videoEl.videoWidth || 1
  const vh = videoEl.videoHeight || 1
  canvas.width = vw
  canvas.height = vh
  const ctx = canvas.getContext('2d')
  ctx.drawImage(videoEl, 0, 0, vw, vh)
  return canvas
}

export function useBiometric() {
  const busy = ref(false)
  const error = ref('')

  // Verify and enroll via server-side InsightFace
  // Captures image from video and uploads to backend for processing
  async function verifyAndUpload(videoEl) {
    busy.value = true
    error.value = ''
    
    if (!videoEl) {
      error.value = 'Video element not found'
      busy.value = false
      return null
    }

    try {
      // Wait for video to have valid frame data
      if (videoEl.readyState < 2 || !videoEl.videoWidth) {
        await new Promise((resolve) => {
          const check = () => {
            if (videoEl.readyState >= 2 && videoEl.videoWidth) return resolve()
            requestAnimationFrame(check)
          }
          check()
          setTimeout(resolve, 3000)
        })
      }

      if (!videoEl.videoWidth || !videoEl.videoHeight) {
        error.value = 'Could not access camera'
        return null
      }

      // Capture frame to canvas and convert to blob
      const canvas = captureImageFromVideo(videoEl)
      if (!canvas) {
        error.value = 'Could not capture image from camera'
        return null
      }

      // Convert canvas to blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95))
      if (!blob) {
        error.value = 'Could not process captured image'
        return null
      }

      // Create FormData with image
      const formData = new FormData()
      formData.append('image', blob, 'capture.jpg')

      // Send to backend for verification/enrollment
      const result = await api.post('/biometric/verify', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      return result?.biometric_token || null
    } catch (e) {
      error.value = e.response?.data?.message || 'Biometric verification failed. Please try again.'
      console.error('[useBiometric] Error:', e)
      return null
    } finally {
      busy.value = false
    }
  }

  // Get enrollment status
  async function getStatus() {
    try {
      const result = await api.get('/biometric/status')
      return result
    } catch (e) {
      console.error('[useBiometric] Status check failed:', e)
      return null
    }
  }

  return { isSupported: true, busy, error, verifyAndUpload, getStatus }
}
