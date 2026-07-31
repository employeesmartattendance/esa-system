<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="modal-box ccm-box" @click.stop>
          <div class="modal-header">
            <div class="modal-header-left">
              <div class="modal-icon-wrap">
                <AppIcon name="camera" :size="20" color="var(--primary)" />
              </div>
              <div>
                <h3 class="modal-title">{{ title }}</h3>
                <p class="modal-subtitle">{{ subtitle }}</p>
              </div>
            </div>
            <button class="modal-close" @click="close" :disabled="stage === 'uploading'">
              <AppIcon name="close" :size="18" />
            </button>
          </div>

          <div class="modal-body ccm-body">
            <div class="ccm-stage">
              <video ref="videoRef" class="ccm-video" autoplay playsinline muted></video>
              <canvas ref="canvasRef" style="display:none"></canvas>

              <!-- Guide circle -->
              <div class="ccm-guide" :class="stage === 'ready' ? 'ccm-guide-ready' : ''"></div>

              <!-- Loading camera -->
              <div v-if="stage === 'loading'" class="ccm-overlay-msg">
                <span class="ccm-spinner"></span>
                <span>Starting camera…</span>
              </div>

              <!-- Camera denied -->
              <div v-else-if="stage === 'denied'" class="ccm-overlay-msg ccm-overlay-error">
                <AppIcon name="alert-triangle" :size="22" color="var(--danger)" />
                <span>Camera access was denied. Please allow camera access in your browser settings and try again.</span>
              </div>

              <!-- Unsupported -->
              <div v-else-if="stage === 'unsupported'" class="ccm-overlay-msg ccm-overlay-error">
                <AppIcon name="alert-triangle" :size="22" color="var(--danger)" />
                <span>Camera access isn't available on this device or browser.</span>
              </div>

              <!-- Uploading/Verifying -->
              <div v-else-if="stage === 'uploading'" class="ccm-overlay-msg ccm-overlay-uploading">
                <span class="ccm-spinner"></span>
                <span>{{ actionLabel }}…</span>
              </div>

              <!-- Success -->
              <div v-else-if="stage === 'success'" class="ccm-overlay-msg ccm-overlay-success">
                <AppIcon name="check-circle" :size="24" color="var(--success)" />
                <span>Verified!</span>
              </div>

              <!-- Error -->
              <div v-else-if="stage === 'error'" class="ccm-overlay-msg ccm-overlay-error">
                <AppIcon name="alert-triangle" :size="22" color="var(--danger)" />
                <span>{{ errorMessage }}</span>
              </div>
            </div>

            <div class="ccm-tip">
              <AppIcon name="info" :size="14" color="var(--text-muted)" />
              <span>Position your face in the circle and tap Capture</span>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-ghost" @click="close" :disabled="stage === 'uploading'">
              {{ stage === 'error' || stage === 'success' ? 'Close' : 'Cancel' }}
            </button>
            <button
              v-if="stage !== 'error' && stage !== 'success'"
              class="btn btn-primary"
              @click="capture"
              :disabled="!canCapture"
            >
              <span v-if="stage === 'uploading'" class="ccm-btn-spinner"></span>
              <AppIcon v-else name="camera" :size="15" />
              {{ stage === 'uploading' ? actionLabel + '…' : 'Capture' }}
            </button>
            <button v-else class="btn btn-primary" @click="close">
              <AppIcon name="check" :size="15" />
              OK
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import AppIcon from './AppIcon.vue'
import { useCameraCapture } from '../../composables/useCameraCapture'

const props = defineProps({
  modelValue: Boolean,
  action: { type: String, default: 'checkin' }, // 'checkin' | 'checkout'
})
const emit = defineEmits(['update:modelValue', 'success', 'error'])

const capture = useCameraCapture()
const videoRef = ref(null)
const canvasRef = ref(null)
const stage = ref('loading') // loading | ready | uploading | success | error | denied | unsupported
const errorMessage = ref('')
let stream = null
let capturing = false

const title = computed(() => {
  if (props.action === 'checkout') return 'Verify Face to Check Out'
  return 'Verify Face to Check In'
})

const subtitle = computed(() => {
  if (props.action === 'checkout') return 'Look directly at the camera'
  return 'Look directly at the camera to verify your identity'
})

const actionLabel = computed(() => {
  if (props.action === 'checkout') return 'Verifying'
  return 'Verifying'
})

const canCapture = computed(() =>
  !capturing && ['ready', 'error'].includes(stage.value)
)

async function startCamera() {
  stage.value = 'loading'
  errorMessage.value = ''

  if (!capture.isSupported) {
    stage.value = 'unsupported'
    return
  }

  try {
    stream = await capture.requestCamera()
    await nextTick()
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await videoRef.value.play().catch(() => {})

      // Wait for valid video dimensions
      if (!videoRef.value.videoWidth) {
        await new Promise((resolve) => {
          const check = () => {
            if (videoRef.value && videoRef.value.videoWidth) return resolve()
            requestAnimationFrame(check)
          }
          check()
          setTimeout(resolve, 3000)
        })
      }
    }
    stage.value = 'ready'
  } catch (e) {
    console.error('[CameraCaptureModal] Camera start error:', e)
    stage.value = e?.name === 'NotAllowedError' ? 'denied' : 'unsupported'
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
    stream = null
  }
  if (videoRef.value) videoRef.value.srcObject = null
}

async function capture() {
  if (capturing) return
  capturing = true
  stage.value = 'uploading'
  errorMessage.value = ''

  try {
    const blob = await capture.captureFrame(videoRef.value, canvasRef.value)
    if (!blob) {
      stage.value = 'error'
      errorMessage.value = 'Could not capture frame. Please try again.'
      return
    }

    const result = await capture.verify(blob, props.action)

    if (result?.biometric_token) {
      stage.value = 'success'
      setTimeout(() => {
        emit('success', { biometric_token: result.biometric_token, enrolled: result.enrolled, similarity: result.similarity })
        close()
      }, 500)
    } else {
      stage.value = 'error'
      errorMessage.value = capture.error.value || 'Verification failed. Please try again.'
      emit('error', errorMessage.value)
    }
  } catch (e) {
    console.error('[CameraCaptureModal] Capture error:', e)
    stage.value = 'error'
    errorMessage.value = 'Something went wrong. Please try again.'
    emit('error', errorMessage.value)
  } finally {
    capturing = false
  }
}

function close() {
  if (stage.value === 'uploading') return
  emit('update:modelValue', false)
}

watch(() => props.modelValue, (open) => {
  if (open) startCamera()
  else stopCamera()
})

onBeforeUnmount(stopCamera)
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(6, 10, 20, 0.78);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal-box {
  background: var(--bg, #ffffff);
  opacity: 1;
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-xl);
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
}
.ccm-box { max-width: 420px; }

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 22px 24px 16px;
  border-bottom: 1px solid var(--surface-border);
  gap: 12px;
  flex-shrink: 0;
}
.modal-header-left { display: flex; align-items: center; gap: 12px; }
.modal-icon-wrap {
  width: 40px; height: 40px;
  border-radius: var(--radius);
  background: rgba(37,99,235,0.1);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.modal-title    { font-size: 16px; font-weight: 700; }
.modal-subtitle { font-size: 12.5px; color: var(--text-muted); margin-top: 2px; }
.modal-close {
  width: 32px; height: 32px;
  border-radius: 50%;
  border: 1px solid var(--surface-border);
  background: var(--surface);
  color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0;
  transition: all 0.2s;
}
.modal-close:hover { background: var(--danger); color: #fff; border-color: var(--danger); }

.modal-footer {
  padding: 14px 24px 20px;
  display: flex; justify-content: flex-end; gap: 10px;
  border-top: 1px solid var(--surface-border);
  flex-shrink: 0;
}

.ccm-body { padding: 22px 24px 18px; display: flex; flex-direction: column; gap: 14px; align-items: center; overflow-y: auto; flex: 1 1 auto; min-height: 0; }

.ccm-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  max-width: 300px;
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: #0a0e14;
  display: flex; align-items: center; justify-content: center;
}
.ccm-video {
  width: 100%; height: 100%; object-fit: cover;
  transform: scaleX(-1);
}
.ccm-guide {
  position: absolute; inset: 12%;
  border: 2.5px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  pointer-events: none;
  transition: border-color 0.25s ease;
}
.ccm-guide-ready { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(37,99,235,0.15); }

.ccm-overlay-msg {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 20px; text-align: center;
  font-size: 13px; color: #e5e7eb;
  background: rgba(10,14,20,0.82);
}
.ccm-overlay-error   { color: #fecaca; }
.ccm-overlay-uploading { background: rgba(10,14,20,0.55); }
.ccm-overlay-success { color: #bbf7d0; font-weight: 700; font-size: 14px; }

.ccm-spinner {
  width: 22px; height: 22px;
  border: 3px solid rgba(255,255,255,0.25); border-top-color: #fff;
  border-radius: 50%; animation: ccm-spin 0.7s linear infinite;
}
@keyframes ccm-spin { to { transform: rotate(360deg); } }

.ccm-tip {
  display: flex; align-items: center; gap: 6px;
  font-size: 11.5px; color: var(--text-muted);
  text-align: center;
}

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  padding: 11px 18px; border-radius: var(--radius-sm); border: none;
  font-size: 14px; font-weight: 700; cursor: pointer;
  transition: all 0.2s; font-family: var(--font);
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--primary-dark));
  color: #fff; box-shadow: 0 4px 16px var(--primary-glow);
}
.btn-primary:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 8px 24px var(--primary-glow); }
.btn-ghost {
  background: transparent; border: 1px solid var(--surface-border); color: var(--text-secondary);
}
.btn-ghost:not(:disabled):hover { background: var(--surface); }

.ccm-btn-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
  border-radius: 50%; animation: ccm-spin 0.7s linear infinite;
  flex-shrink: 0;
}
</style>
