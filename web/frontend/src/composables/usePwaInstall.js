import { ref } from 'vue'

// Shared module-level state so every component using this composable reflects
// the same install availability/status without prop drilling.
const deferredPrompt = ref(null)
const isInstallable = ref(false)
const isInstalled = ref(false)
const isIos = ref(false)

function detectStandalone() {
  const displayModeStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = window.navigator.standalone === true
  return Boolean(displayModeStandalone || iosStandalone)
}

function detectIos() {
  const ua = window.navigator.userAgent || ''
  return /iphone|ipad|ipod/i.test(ua) && !window.MSStream
}

let initialized = false

function init() {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  isInstalled.value = detectStandalone()
  isIos.value = detectIos()

  window.addEventListener('beforeinstallprompt', (event) => {
    // Prevent the default mini-infobar and stash the event so we can
    // trigger it later from our own "Install App" button.
    event.preventDefault()
    deferredPrompt.value = event
    isInstallable.value = !isInstalled.value
  })

  window.addEventListener('appinstalled', () => {
    isInstalled.value = true
    isInstallable.value = false
    deferredPrompt.value = null
  })

  // Keep state in sync if the user installs/uninstalls or switches into the
  // installed app window while this tab is still open.
  const media = window.matchMedia('(display-mode: standalone)')
  const onChange = () => { isInstalled.value = detectStandalone() }
  if (media.addEventListener) media.addEventListener('change', onChange)
  else if (media.addListener) media.addListener(onChange)

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // Silently ignore — the app must keep working fully without a service
      // worker (e.g. unsupported browser, blocked by embedder, etc.)
    })
  }
}

export function usePwaInstall() {
  init()

  async function promptInstall() {
    const promptEvent = deferredPrompt.value
    if (!promptEvent) return { outcome: 'unavailable' }
    promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') {
      isInstalled.value = true
    }
    isInstallable.value = false
    deferredPrompt.value = null
    return choice
  }

  return {
    isInstallable,
    isInstalled,
    isIos,
    promptInstall,
  }
}
