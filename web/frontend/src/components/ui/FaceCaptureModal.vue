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
              <video ref="videoRef" class="fcm-video" autoplay playsinline muted @loadedmetadata="onVideoReady"></video>
              <div
                class="fcm-guide"
                :class="stage === 'ready' ? `fcm-guide-live-${liveStatus}` : `fcm-guide-${stage}`"
              ></div>

              <div v-if="stage === 'ready'" class="fcm-live-hint" :class="`fcm-live-hint-${liveStatus}`">
                <AppIcon
                  :name="liveStatus === 'centered' ? 'check-circle' : 'info'"
                  :size="14"
                  :color="liveStatus === 'centered' ? 'var(--success)' : '#fff'"
                />
                <span>{{ liveHintText }}</span>
              </div>

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
              <div v-else-if="stage === 'models-error'" class="fcm-overlay-msg fcm-overlay-error">
                <AppIcon name="alert-triangle" :size="22" color="var(--danger)" />
                <span>{{ mismatchMsg }}</span>
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
              :disabled="stage !== 'ready' && stage !== 'no-face' && stage !== 'mismatch' && stage !== 'models-error'"
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
const stage = ref('loading') // loading | ready | capturing | no-face | models-error | mismatch | success | denied | unsupported
const mismatchMsg = ref('')
let stream = null

// ── Live face guide ─────────────────────────────────────────────────────
// While stage === 'ready', poll the video feed at a light interval and
// classify the current frame so the guide ring + hint text can tell the
// user in real time whether their face is detected and centered — instead
// of only finding out after pressing Capture.
const liveStatus = ref('searching') // searching | detected | centered | off-center | too-small | too-large
const liveHintText = ref('Position your face in the circle')
let liveLoopTimer = null
let liveLoopRunning = false
let modelsReady = false

function computeLiveStatus(box, videoEl) {
  if (!box) return { status: 'searching', text: 'Position your face in the circle' }

  const vw = videoEl.videoWidth || 1
  const vh = videoEl.videoHeight || 1
  const boxCx = box.x + box.width / 2
  const boxCy = box.y + box.height / 2
  const videoCx = vw / 2
  const videoCy = vh / 2

  const offX = Math.abs(boxCx - videoCx) / vw
  const offY = Math.abs(boxCy - videoCy) / vh
  const sizeRatio = box.width / vw

  if (sizeRatio < 0.16) return { status: 'too-small', text: 'Move a little closer' }
  if (sizeRatio > 0.75) return { status: 'too-large', text: 'Move back slightly' }
  if (offX > 0.16 || offY > 0.16) return { status: 'off-center', text: 'Center your face in the circle' }
  return { status: 'centered', text: 'Perfect — hold still and tap Capture' }
}

async function liveDetectTick() {
  if (!videoRef.value || stage.value !== 'ready') return
  try {
    const box = await biometric.detectFacePosition(videoRef.value)
    if (stage.value !== 'ready') return
    const { status, text } = computeLiveStatus(box, videoRef.value)
    liveStatus.value = status
    liveHintText.value = text
  } catch {
    // Non-fatal: leave last-known status, retry on next tick.
  }
}

function startLiveLoop() {
  if (liveLoopRunning) return
  liveLoopRunning = true
  liveStatus.value = 'searching'
  liveHintText.value = 'Position your face in the circle'
  const tick = async () => {
    if (!liveLoopRunning) return
    await liveDetectTick()
    if (liveLoopRunning) liveLoopTimer = setTimeout(tick, 350)
  }
  tick()
}

function stopLiveLoop() {
  liveLoopRunning = false
  if (liveLoopTimer) { clearTimeout(liveLoopTimer); liveLoopTimer = null }
}

function onVideoReady() {
  // Video element has valid dimensions now; live loop starts via the stage
  // watcher below once stage flips to 'ready'.
}

async function startCamera() {
  stage.value = 'loading'
  if (!biometric.isSupported) { stage.value = 'unsupported'; return }
  try {
    // Preload the models in parallel with camera startup so the first
    // capture doesn't stall on a cold model download.
    if (!modelsReady) {
      biometric.loadModels().then(() => { modelsReady = true }).catch(() => {})
    }
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
  stopLiveLoop()
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
  if (videoRef.value) videoRef.value.srcObject = null
}

watch(stage, (s) => {
  if (s === 'ready') startLiveLoop()
  else stopLiveLoop()
})

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
  } catch (e) {
    if (e?.code === 'MODELS_UNAVAILABLE') {
      mismatchMsg.value = e.message || 'Face detection could not start. Check your connection and try again.'
      stage.value = 'models-error'
    } else {
      stage.value = 'no-face'
    }
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
/* Explicit, self-contained overlay + box/header/body/footer styling so this
   modal always renders a full solid backdrop, opaque card, and comfortable
   padding — never relies on another component's global styles being
   present/loaded first. */
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
.fcm-box { max-width: 460px; }

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24px 26px 18px;
  border-bottom: 1px solid var(--surface-border);
  gap: 12px;
  flex-shrink: 0;
}
.modal-header-left { display: flex; align-items: center; gap: 12px; }
.modal-icon-wrap {
  width: 42px; height: 42px;
  border-radius: var(--radius);
  background: rgba(37, 99, 235, 0.1);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.modal-title    { font-size: 17px; font-weight: 700; }
.modal-subtitle { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
.modal-close {
  width: 32px; height: 32px;
  border-radius: 50%;
  border: 1px solid var(--surface-border);
  background: var(--surface);
  color: var(--text-secondary);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
}
.modal-close:hover { background: var(--danger); color: #fff; border-color: var(--danger); }

.modal-footer {
  padding: 16px 26px 22px;
  display: flex; justify-content: flex-end; gap: 10px;
  border-top: 1px solid var(--surface-border);
  flex-shrink: 0;
}

.fcm-body { padding: 26px 26px 24px; display: flex; flex-direction: column; gap: 16px; align-items: center; overflow-y: auto; flex: 1 1 auto; min-height: 0; }

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

/* Live guide states — driven by continuous on-device face detection while
   the user positions themselves, so the ring itself signals when to shoot. */
.fcm-guide-live-searching   { border-color: rgba(255,255,255,0.4); }
.fcm-guide-live-off-center  { border-color: var(--warning); }
.fcm-guide-live-too-small   { border-color: var(--warning); }
.fcm-guide-live-too-large   { border-color: var(--warning); }
.fcm-guide-live-centered    { border-color: var(--success); box-shadow: 0 0 0 4px rgba(34,197,94,0.18); }

.fcm-live-hint {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(6, 10, 20, 0.72);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
  max-width: 90%;
  transition: background-color 0.25s ease, color 0.25s ease;
  pointer-events: none;
}
.fcm-live-hint-centered {
  background: rgba(22, 163, 74, 0.9);
}

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
