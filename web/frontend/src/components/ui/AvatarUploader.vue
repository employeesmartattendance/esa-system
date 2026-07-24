<template>
  <div class="avatar-uploader" :class="size">
    <div class="au-circle">
      <img v-if="avatarUrl" :src="avatarUrl" :alt="name || 'Profile photo'" class="au-img" />
      <span v-else class="au-initials">{{ initials }}</span>

      <div v-if="uploading" class="au-uploading">
        <span class="au-spinner"></span>
      </div>
    </div>

    <button
      type="button"
      class="au-camera-btn"
      :disabled="uploading"
      title="Change profile photo"
      @click="triggerPicker"
    >
      <AppIcon name="camera" :size="14" />
    </button>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="au-hidden-input"
      @change="onFileSelected"
    />

    <p v-if="errorMsg" class="au-error">{{ errorMsg }}</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import AppIcon from './AppIcon.vue'
import api from '../../api'

const props = defineProps({
  avatar:  { type: String, default: '' },
  name:    { type: String, default: '' },
  size:    { type: String, default: 'md' }, // 'sm' | 'md' | 'lg'
})
const emit = defineEmits(['uploaded', 'error'])

const fileInput  = ref(null)
const uploading   = ref(false)
const errorMsg    = ref('')
// Local preview takes priority right after upload so the UI updates
// instantly, even before the parent re-renders with the saved user.
const localAvatar = ref('')

const API = import.meta.env.VITE_API_URL || 'https://esa-system.onrender.com/api'
const apiBase = API.replace('/api', '')

function resolveUrl(url) {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('//') || url.startsWith('data:')) return url
  return `${apiBase}${url}`
}

const avatarUrl = computed(() => resolveUrl(localAvatar.value || props.avatar))

const initials = computed(() =>
  (props.name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
)

function triggerPicker() {
  errorMsg.value = ''
  fileInput.value?.click()
}

async function onFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  errorMsg.value = ''

  if (!file.type.startsWith('image/')) {
    errorMsg.value = 'Please select an image file'
    e.target.value = ''
    return
  }
  if (file.size > 3 * 1024 * 1024) {
    errorMsg.value = 'Image must be under 3MB'
    e.target.value = ''
    return
  }

  // Instant local preview while the upload is in flight
  const reader = new FileReader()
  reader.onload = (ev) => { localAvatar.value = ev.target.result }
  reader.readAsDataURL(file)

  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('avatar', file)
    const updated = await api.post('/auth/avatar', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    // Switch from the local data-URL preview to the real saved URL
    localAvatar.value = updated?.avatar || ''
    emit('uploaded', updated)
  } catch (err) {
    localAvatar.value = ''
    const msg = err.response?.data?.message || 'Failed to upload photo'
    errorMsg.value = msg
    emit('error', msg)
  } finally {
    uploading.value = false
    e.target.value = ''
  }
}
</script>

<style scoped>
.avatar-uploader { position: relative; display: inline-flex; flex-direction: column; align-items: center; width: fit-content; }
.au-hidden-input { display: none; }

.au-circle {
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 800;
  overflow: hidden; position: relative; flex-shrink: 0;
}
.au-img { width: 100%; height: 100%; object-fit: cover; }

/* Sizes */
.avatar-uploader.sm .au-circle { width: 44px; height: 44px; font-size: 15px; }
.avatar-uploader.md .au-circle { width: 64px; height: 64px; font-size: 20px; }
.avatar-uploader.lg .au-circle { width: 92px; height: 92px; font-size: 28px; }

.au-camera-btn {
  position: absolute; bottom: 0; right: 0;
  width: 26px; height: 26px; border-radius: 50%;
  background: var(--primary); color: #fff;
  border: 2px solid var(--surface);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.avatar-uploader.lg .au-camera-btn { width: 32px; height: 32px; bottom: 2px; right: 2px; }
.au-camera-btn:hover:not(:disabled) { background: var(--primary-dark); transform: scale(1.08); }
.au-camera-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.au-uploading {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
}
.au-spinner {
  width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #fff; border-radius: 50%;
  animation: au-spin 0.7s linear infinite;
}
@keyframes au-spin { to { transform: rotate(360deg); } }

.au-error {
  font-size: 11px; color: var(--danger); margin-top: 6px;
  text-align: center; max-width: 160px;
}
</style>
