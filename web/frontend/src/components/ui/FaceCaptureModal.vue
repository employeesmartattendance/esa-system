<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="modal-box fcm-box" @click.stop>
          <div class="modal-header">
            <div class="modal-header-left">
              <div class="modal-icon-wrap">
                <AppIcon name="camera" :size="20" color="var(--primary)" />
              </div>
              <div>
                <h3 class="modal-title">{{ mode === 'enroll' ? 'Set Up Face Verification' : 'Verify Your Face' }}</h3>
                <p class="modal-subtitle">{{ mode === 'enroll' ? 'Look directly at the camera in good lighting' : 'Look directly at the camera to check in' }}</p>
              </div>
            </div>
            <button class="modal-close" @click="close">
              <AppIcon name="close" :size="18" />
            </button>
          </div>

          <div class="modal-body fcm-body">
            <div class="fcm-stage" :class="{ 'fcm-stage-active': stage === 'ready' || stage === 'capturing' }">
              <video ref="videoRef" class="fcm-video" autoplay playsinline muted></video>
              <div class="fcm-guide" :class="`fcm-guide-${stage}`"></div>

              <div v-if="stage === 'loading'" class="fcm-overlay-msg">
                <span class="fcm-spinner"></span>
                <span>Starting camera…</span>
              </div>
              <div v-else-if="stage === 'denied'" class="fcm-overlay-msg fcm-overlay-error">
                <AppIcon name="alert-triangle" :size="22" color="var(--danger)" />
                <span>Camera access was denied. Please allow camera access in your browser settings and try again.</span>
              </div>
              <div v-else-if="stage === 'unsupported'" class="fcm-overlay-msg fcm-overlay-error">
                <AppIcon name="alert-triangle" :size="22" color="var(--danger)" />
                <span>Camera access isn't available on this device or browser.</span>
              </div>
              <div v-else-if="stage === 'capturing'" class="fcm-overlay-msg">
                <span class="fcm-spinner"></span>
                <span>{{ mode === 'enroll' ? 'Capturing your face…' : 'Verifying…' }}</span>
              </div>
              <div v-else-if="stage === 'no-face'" class="fcm-overlay-msg fcm-overlay-warn">
                <AppIcon name="alert-triangle" :size="20" color="var(--warning)" />
                <span>No face detected — center your face in the frame and try again.</span>
              </div>
              <div v-else-if="stage === 'mismatch'" class="fcm-overlay-msg fcm-overlay-error">
                <AppIcon name="x-circle" :size="22" color="var(--danger)" />
                <span>{{ mismatchMsg }}</span>
              </div>
              <div v-else-if="stage === 'success'" class="fcm-overlay-msg fcm-overlay-success">
                <AppIcon name="check-circle" :size="24" color="var(--success)" />
                <span>{{ mode === 'enroll' ? 'Face captured!' : 'Verified!' }}</span>
              </div>
            </div>

            <div class="fcm-tip">
              <AppIcon name="info" :size="14" color="var(--text-muted)" />
              <span>Only a numeric face descriptor is stored — never a photo or video.</span>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-ghost" @click="close" :disabled="stage === 'capturing'">Cancel</button>
            <button
              class="btn btn-primary"
              @click="capture"
              :disabled="stage !== 'ready' && stage !== 'no-face' && stage !== 'mismatch'"
            >
              <AppIcon name="camera" :size="15" />
              {{ mode === 'enroll' ? 'Capture' : 'Verify' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import AppIcon from './AppIcon.vue'
import { useBiometric } from '../../composables/useBiometric'

const props = defineProps({
  modelValue: Boolean,
  mode: { type: String, default: 'enroll' }, // 'enroll' | 'verify'
})
const emit = defineEmits(['update:modelValue', 'success', 'error'])

const biometric = useBiometric()
const videoRef = ref(null)
const stage = ref('loading') // loading | ready | capturing | no-face | mismatch | success | denied | unsupported
const mismatchMsg = ref('')
let stream = null

async function startCamera() {
  stage.value = 'loading'
  if (!biometric.isSupported) { stage.value = 'unsupported'; return }
  try {
    // Preload the models in parallel with camera startup so the first
    // capture doesn't stall on a cold model download.
    biometric.loadModels().catch(() => {})
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } }, audio: false })
    await nextTick()
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await videoRef.value.play().catch(() => {})
    }
    stage.value = 'ready'
  } catch (e) {
    stage.value = e?.name === 'NotAllowedError' ? 'denied' : 'unsupported'
  }
}

function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
  if (videoRef.value) videoRef.value.srcObject = null
}

async function capture() {
  stage.value = 'capturing'
  mismatchMsg.value = ''
  try {
    const descriptor = await biometric.captureDescriptor(videoRef.value)
    if (!descriptor) { stage.value = 'no-face'; return }

    if (props.mode === 'enroll') {
      const ok = await biometric.enroll(descriptor)
      if (ok) {
        stage.value = 'success'
        setTimeout(() => { emit('success'); close() }, 700)
      } else {
        mismatchMsg.value = biometric.error.value || 'Could not set up biometric verification.'
        stage.value = 'mismatch'
        emit('error', mismatchMsg.value)
      }
    } else {
      const token = await biometric.verify(descriptor)
      if (token) {
        stage.value = 'success'
        setTimeout(() => { emit('success', token); close() }, 500)
      } else {
        mismatchMsg.value = biometric.error.value || 'Face did not match.'
        stage.value = 'mismatch'
        emit('error', mismatchMsg.value)
      }
    }
  } catch {
    stage.value = 'no-face'
  }
}

function close() {
  if (stage.value === 'capturing') return
  emit('update:modelValue', false)
}

watch(() => props.modelValue, (open) => {
  if (open) startCamera()
  else stopCamera()
})
onBeforeUnmount(stopCamera)
</script>

<style scoped>
.fcm-box { max-width: 460px; }
.fcm-body { display: flex; flex-direction: column; gap: 14px; align-items: center; }

.fcm-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  max-width: 320px;
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: #0a0e14;
  display: flex; align-items: center; justify-content: center;
}
.fcm-video {
  width: 100%; height: 100%; object-fit: cover;
  transform: scaleX(-1); /* mirror, like a mirror/selfie cam */
}
.fcm-guide {
  position: absolute; inset: 10%;
  border: 3px solid rgba(255,255,255,0.35);
  border-radius: 50%;
  pointer-events: none;
  transition: border-color 0.25s ease;
}
.fcm-guide-ready { border-color: var(--primary); }
.fcm-guide-capturing { border-color: var(--warning); }

.fcm-overlay-msg {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 20px; text-align: center;
  font-size: 13px; color: #e5e7eb;
  background: rgba(10,14,20,0.82);
}
.fcm-overlay-error   { color: #fecaca; }
.fcm-overlay-warn    { color: #fde68a; }
.fcm-overlay-success { color: #bbf7d0; font-weight: 700; font-size: 14px; }

.fcm-spinner {
  width: 22px; height: 22px;
  border: 3px solid rgba(255,255,255,0.25); border-top-color: #fff;
  border-radius: 50%; animation: fcm-spin 0.7s linear infinite;
}
@keyframes fcm-spin { to { transform: rotate(360deg); } }

.fcm-tip {
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
</style>
