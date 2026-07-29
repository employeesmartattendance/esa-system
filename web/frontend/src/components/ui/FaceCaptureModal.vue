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
              <canvas ref="canvasRef" style="display:none"></canvas>
              <div
                class="fcm-guide"
                :class="stage === 'ready' ? `fcm-guide-live-${liveStatus}` : `fcm-guide-${stage}`"
              ></div>

              <!-- Biometric / Face ID style scan animation. Runs whenever a face is
                   visible in frame (regardless of centering), giving the familiar
                   scanning-ring feedback while the user positions themselves — this
                   "detected, not yet verifying" state uses blue (fcm-scan-anim-blue)
                   to visually distinguish it from the green verifying animation
                   below, which only plays during the actual capture/verify moment. -->
              <div v-if="stage === 'ready' && liveStatus !== 'searching'" class="fcm-scan-anim fcm-scan-anim-blue" aria-hidden="true">
                <span class="fcm-scan-band"></span>
                <span class="fcm-scan-line"></span>
                <svg class="fcm-scan-corners" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path d="M8,22 V10 A4,4 0 0 1 12,6 H24" class="fcm-corner" />
                  <path d="M76,6 H88 A4,4 0 0 1 92,10 V22" class="fcm-corner" />
                  <path d="M92,78 V90 A4,4 0 0 1 88,94 H76" class="fcm-corner" />
                  <path d="M24,94 H12 A4,4 0 0 1 8,90 V78" class="fcm-corner" />
                </svg>
              </div>
              <div v-if="stage === 'ready'" class="fcm-live-hint" :class="`fcm-live-hint-${liveStatus}`">
                <AppIcon
                  :name="liveStatus === 'searching' ? 'info' : 'check-circle'"
                  :size="14"
                  :color="liveStatus === 'searching' ? '#fff' : 'var(--primary)'"
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
              <div v-else-if="stage === 'capturing'" class="fcm-overlay-msg fcm-overlay-scanning">
                <div class="fcm-scan-anim fcm-scan-anim-fast fcm-scan-anim-green" aria-hidden="true">
                  <span class="fcm-scan-band"></span>
                  <span class="fcm-scan-line"></span>
                  <svg class="fcm-scan-corners" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <path d="M8,22 V10 A4,4 0 0 1 12,6 H24" class="fcm-corner" />
                    <path d="M76,6 H88 A4,4 0 0 1 92,10 V22" class="fcm-corner" />
                    <path d="M92,78 V90 A4,4 0 0 1 88,94 H76" class="fcm-corner" />
                    <path d="M24,94 H12 A4,4 0 0 1 8,90 V78" class="fcm-corner" />
                  </svg>
                </div>
                <span class="fcm-scanning-text">{{ mode === 'enroll' ? 'Capturing your face…' : 'Verifying…' }}</span>
              </div>
              <div v-else-if="stage === 'no-face'" class="fcm-overlay-msg fcm-overlay-warn">
                <AppIcon name="alert-triangle" :size="20" color="var(--warning)" />
                <span>No face detected — make sure your face is inside the circle, in good lighting, and try again.</span>
              </div>
              <div v-else-if="stage === 'models-error'" class="fcm-overlay-msg fcm-overlay-error">
                <AppIcon name="alert-triangle" :size="22" color="var(--danger)" />
                <span>{{ mismatchMsg }}</span>
              </div>
              <div v-else-if="stage === 'mismatch'" class="fcm-overlay-msg fcm-overlay-error">
                <AppIcon name="x-circle" :size="22" color="var(--danger)" />
                <span>{{ mismatchMsg }}</span>
              </div>
              <div v-else-if="stage === 'already-enrolled'" class="fcm-overlay-msg fcm-overlay-warn">
                <AppIcon name="info" :size="22" color="var(--warning)" />
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
            <button class="btn btn-ghost" @click="close" :disabled="stage === 'capturing'">
              {{ stage === 'already-enrolled' ? 'Close' : 'Cancel' }}
            </button>
            <button
              v-if="stage !== 'already-enrolled'"
              class="btn btn-primary"
              @click="capture"
              :disabled="!canCapture"
            >
              <span v-if="stage === 'capturing'" class="fcm-btn-spinner"></span>
              <AppIcon v-else name="camera" :size="15" />
              {{ stage === 'capturing' ? (mode === 'enroll' ? 'Capturing…' : 'Verifying…') : (mode === 'enroll' ? 'Capture' : 'Verify') }}
            </button>
            <button v-else class="btn btn-primary" @click="close">
              <AppIcon name="check" :size="15" />
              Got it
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
import { useBiometric } from '../../composables/useBiometric'

const props = defineProps({
  modelValue: Boolean,
  mode: { type: String, default: 'enroll' }, // 'enroll' | 'verify'
})
const emit = defineEmits(['update:modelValue', 'success', 'error'])

const biometric = useBiometric()
const videoRef = ref(null)
const canvasRef = ref(null)
const stage = ref('loading') // loading | ready | capturing | no-face | models-error | mismatch | already-enrolled | success | denied | unsupported
const mismatchMsg = ref('')
let stream = null
let capturing = false // re-entrancy guard — belt-and-braces alongside :disabled

// Capture/Verify is enabled any time we're in a state where pressing it
// makes sense — including right away once the camera is 'ready', even
// before the live guide has classified a face. This is deliberate: face
// detection models loading in the background, or the live guide still
// warming up, should never make the button feel unresponsive to a tap —
// captureDescriptor() awaits model readiness internally, so an early press
// still works, it just takes a beat longer the very first time.
const canCapture = computed(() =>
  !capturing && ['ready', 'no-face', 'mismatch', 'models-error'].includes(stage.value)
)

// ── Live face guide ─────────────────────────────────────────────────────
// While stage === 'ready', poll the video feed at a light interval and
// classify the current frame so the guide ring + hint text can tell the
// user in real time whether their face is detected and centered — instead
// of only finding out after pressing Capture.
const liveStatus = ref('searching') // searching | detected | too-small | too-large
const liveHintText = ref('Position your face in the circle')
let liveLoopTimer = null
let liveLoopRunning = false
let modelsReady = false

// Any face inside the circle counts as good to capture — this no longer
// requires the face to be centered. We only flag genuinely unusable frames
// (face too small/far or too large/close); everything else is 'detected'
// and ready to capture, matching how Face ID / biometric scanners behave:
// they scan whatever face is in frame rather than demanding dead-center.
function computeLiveStatus(box, videoEl) {
  if (!box) return { status: 'searching', text: 'Position your face in the circle' }

  const vw = videoEl.videoWidth || 1
  const sizeRatio = box.width / vw

  if (sizeRatio < 0.12) return { status: 'too-small', text: 'Move a little closer' }
  if (sizeRatio > 0.9) return { status: 'too-large', text: 'Move back slightly' }
  return { status: 'detected', text: 'Face detected — tap Capture' }
}

async function liveDetectTick() {
  if (!videoRef.value || stage.value !== 'ready') return
  try {
    const box = await biometric.detectFacePosition(videoRef.value, canvasRef.value)
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
  mismatchMsg.value = ''
  if (!biometric.isSupported) { stage.value = 'unsupported'; return }
  try {
    // Preload the models in parallel with camera startup so the first
    // capture doesn't stall on a cold model download.
    if (!modelsReady) {
      biometric.loadModels().then(() => { modelsReady = true }).catch((e) => {
        console.error('[FaceCaptureModal] Model preload failed:', e)
      })
    }
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
    await nextTick()
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await videoRef.value.play().catch((e) => {
        console.error('[FaceCaptureModal] Video play failed:', e)
      })
      // Extra safety: wait for the video to report real dimensions before
      // switching to 'ready', so the live loop and capture never run on a
      // zero-sized frame.
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
      console.log('[FaceCaptureModal] Camera ready. Dimensions:', videoRef.value.videoWidth, 'x', videoRef.value.videoHeight)
    }
    stage.value = 'ready'
  } catch (e) {
    console.error('[FaceCaptureModal] Camera start error:', e)
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
  if (capturing) return // guard against double-fire from a rapid double-tap
  capturing = true
  stage.value = 'capturing'
  mismatchMsg.value = ''
  try {
    // A single frame can occasionally miss (blink, motion blur, brief focus
    // hiccup) even with a face clearly in view, which is what produced
    // spurious "no face detected" failures. Retry a couple of times against
    // fresh frames before surfacing the no-face state to the user.
    let descriptor = null
    for (let attempt = 0; attempt < 4 && !descriptor; attempt++) {
      descriptor = await biometric.captureDescriptor(videoRef.value, canvasRef.value)
      if (!descriptor && attempt < 3) await new Promise((r) => setTimeout(r, 350))
    }
    if (!descriptor) { stage.value = 'no-face'; return }

    if (props.mode === 'enroll') {
      const ok = await biometric.enroll(descriptor)
      if (ok) {
        stage.value = 'success'
        setTimeout(() => { emit('success'); close() }, 700)
      } else if (biometric.errorIsConflict.value) {
        // Already enrolled server-side — retrying capture here can never
        // succeed, so say so plainly instead of implying the face/camera
        // failed and inviting an infinite "try again" loop.
        mismatchMsg.value = biometric.error.value || 'Biometric verification is already set up on this account.'
        stage.value = 'already-enrolled'
        emit('error', mismatchMsg.value)
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
    } else if (e?.code === 'DETECTION_ERROR') {
      mismatchMsg.value = e.message || 'Face detection encountered an error.'
      stage.value = 'models-error'
    } else {
      // Anything reaching here is NOT a "no face in frame" situation — it's an
      // unexpected/untagged error (e.g. the camera stream ending mid-capture,
      // a browser API failure). Previously this was mislabeled as 'no-face',
      // which told the person to reposition their face for a problem that had
      // nothing to do with their face — misleading, and it hid the real cause.
      // Reusing 'models-error' surfaces an honest, distinct message instead.
      console.error('[FaceCaptureModal] Unexpected capture error:', e)
      mismatchMsg.value = 'Something went wrong while capturing. Please try again.'
      stage.value = 'models-error'
    }
  } finally {
    capturing = false
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
.fcm-guide-live-too-small   { border-color: var(--warning); }
.fcm-guide-live-too-large   { border-color: var(--warning); }
.fcm-guide-live-detected    { border-color: var(--primary); box-shadow: 0 0 0 4px var(--primary-glow); }

/* Biometric / Face ID style scan animation — a sweeping band (with a
   brighter leading edge) plus animated corner brackets inside the circular
   guide, shown while a face is present. Color is driven by --fcm-scan-color
   (and its -soft/-glow variants) so the same animation can be recolored per
   stage: blue while positioning/detected (.fcm-scan-anim-blue, used during
   stage 'ready'), green while actually verifying (.fcm-scan-anim-green,
   used during stage 'capturing' — this matches the original green look and
   is the default if no modifier class is present). */
.fcm-scan-anim {
  position: absolute; inset: 10%;
  border-radius: 50%;
  overflow: hidden;
  pointer-events: none;
  --fcm-scan-color:      #22c55e;
  --fcm-scan-color-soft: rgba(34,197,94,0.32);
  --fcm-scan-color-mid:  rgba(34,197,94,0.55);
  --fcm-scan-color-glow: rgba(34,197,94,0.85);
}
.fcm-scan-anim-green {
  --fcm-scan-color:      #22c55e;
  --fcm-scan-color-soft: rgba(34,197,94,0.32);
  --fcm-scan-color-mid:  rgba(34,197,94,0.55);
  --fcm-scan-color-glow: rgba(34,197,94,0.85);
}
.fcm-scan-anim-blue {
  --fcm-scan-color:      #2563eb;
  --fcm-scan-color-soft: rgba(37,99,235,0.32);
  --fcm-scan-color-mid:  rgba(37,99,235,0.55);
  --fcm-scan-color-glow: rgba(37,99,235,0.85);
}
.fcm-scan-anim-fast { animation: fcm-scan-pulse 0.6s ease-in-out infinite; }

/* The band is a soft colored glow that trails behind the bright edge line,
   giving the "light sweeping through the face" effect instead of just a
   thin line moving down the frame. */
.fcm-scan-band {
  position: absolute;
  left: 0; right: 0;
  height: 34%;
  background: linear-gradient(
    to bottom,
    rgba(0,0,0,0) 0%,
    var(--fcm-scan-color-soft) 55%,
    var(--fcm-scan-color-mid) 100%
  );
  animation: fcm-scan-band-sweep 2.2s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}
.fcm-scan-anim-fast .fcm-scan-band {
  animation: fcm-scan-band-sweep 0.9s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}
.fcm-scan-line {
  position: absolute;
  left: 4%; right: 4%;
  height: 2.5px;
  background: linear-gradient(90deg, rgba(0,0,0,0) 0%, var(--fcm-scan-color) 50%, rgba(0,0,0,0) 100%);
  box-shadow: 0 0 10px 2px var(--fcm-scan-color-glow);
  animation: fcm-scan-sweep 2.2s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}
.fcm-scan-anim-fast .fcm-scan-line {
  animation: fcm-scan-sweep 0.9s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}
@keyframes fcm-scan-sweep {
  0%   { top: 2%; opacity: 0; }
  8%   { opacity: 1; }
  50%  { top: 96%; opacity: 1; }
  58%  { opacity: 0; }
  100% { top: 2%; opacity: 0; }
}
/* The band sits just above its edge line, so it appears to trail behind it
   as both sweep down together. */
@keyframes fcm-scan-band-sweep {
  0%   { top: -32%; opacity: 0; }
  8%   { opacity: 1; }
  50%  { top: 64%; opacity: 1; }
  58%  { opacity: 0; }
  100% { top: -32%; opacity: 0; }
}
@keyframes fcm-scan-pulse {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}
.fcm-scan-corners {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
}
.fcm-corner {
  fill: none;
  stroke: var(--fcm-scan-color);
  stroke-width: 3;
  stroke-linecap: round;
  filter: drop-shadow(0 0 3px var(--fcm-scan-color-glow));
  animation: fcm-corner-fade 2.2s ease-in-out infinite;
}
@keyframes fcm-corner-fade {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}

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
.fcm-live-hint-detected {
  background: rgba(37, 99, 235, 0.9);
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
.fcm-overlay-scanning { background: rgba(10,14,20,0.55); }
.fcm-overlay-scanning .fcm-scan-anim {
  position: relative; inset: auto;
  width: 140px; height: 140px;
  flex-shrink: 0;
}
.fcm-scanning-text { font-weight: 600; color: #fff; }
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

.fcm-btn-spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
  border-radius: 50%; animation: fcm-spin 0.7s linear infinite;
  flex-shrink: 0;
}
</style>
