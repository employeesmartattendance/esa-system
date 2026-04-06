<template>
  <RouterView />
  <a
    v-if="showWhatsAppFab"
    :href="whatsappHref"
    target="_blank"
    rel="noopener noreferrer"
    class="global-wa-fab"
    aria-label="Chat with us on WhatsApp"
    title="Chat with us on WhatsApp"
  >
    <span class="global-wa-pulse"></span>
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
      />
    </svg>
  </a>

  <!-- ── Offline / Sync Status Banner ──────────────────────────────────── -->
  <Transition name="banner-slide">
    <div v-if="showBanner" class="esa-status-banner" :class="bannerClass">
      <div class="banner-inner">
        <!-- Sync spinner -->
        <span v-if="syncing" class="banner-spinner" />
        <!-- Icon -->
        <span v-else class="banner-icon">{{ bannerIcon }}</span>

        <span class="banner-text">{{ bannerText }}</span>

        <!-- Manual sync button (when offline in Electron) -->
        <button
          v-if="isElectron && !isOnline && !syncing"
          class="banner-sync-btn"
          @click="triggerSync"
        >
          Retry
        </button>
      </div>
    </div>
  </Transition>

  <!-- ── School Deactivation Overlay ───────────────────────────────────── -->
  <Teleport to="body">
    <div v-if="forceLogoutVisible" class="force-logout-overlay">
      <div class="force-logout-modal">
        <div class="flm-icon">!</div>
        <h2>School Deactivated</h2>
        <p>{{ forceLogoutMessage }}</p>
        <button @click="doForceLogout" class="flm-btn">Return to Login</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import { useDark } from "./composables/useDark";
import { useAuthStore } from "./stores/auth";
import { getSocket, connectSocket } from "./socket";

const { isDark } = useDark();
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const isElectron = !!window.electronAPI;
const forceLogoutVisible = ref(false);
const forceLogoutMessage = ref("");
const whatsappHref =
  import.meta.env.VITE_WHATSAPP_URL || "https://wa.me/250788000000";
const showWhatsAppFab = computed(() => {
  const path = route.path || "";
  return (
    !["/super", "/school", "/teacher"].includes(path) &&
    !path.startsWith("/super/") &&
    !path.startsWith("/school/") &&
    !path.startsWith("/teacher/")
  );
});

// ── Sync / Online state ────────────────────────────────────────────────────
const isOnline = ref(navigator.onLine);
const syncing = ref(false);
const lastSyncTime = ref(null); // epoch ms
const pendingCount = ref(0);
let _unsubSyncStatus = null;

// ── Banner logic ──────────────────────────────────────────────────────────
const showBanner = computed(() => !isOnline.value || syncing.value);

const bannerClass = computed(() => {
  if (syncing.value) return "banner--syncing";
  if (!isOnline.value) return "banner--offline";
  return "";
});

const bannerIcon = computed(() => {
  if (!isOnline.value) return "📵";
  return "✅";
});

const bannerText = computed(() => {
  if (syncing.value) return "Syncing with server…";

  if (!isOnline.value) {
    const age = _relativeTime(lastSyncTime.value);
    const queue =
      pendingCount.value > 0 ? ` · ${pendingCount.value} queued` : "";
    if (isElectron) {
      return age
        ? `You are offline. Showing last synced data. Last sync ${age}${queue}`
        : `You are offline. Showing last synced data.${queue}`;
    }
    return age
      ? `Offline — Last synced ${age}${queue}`
      : "Offline — No cached data";
  }
  return "";
});

function _relativeTime(ms) {
  if (!ms) return null;
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} day(s) ago`;
}

// ── Pull initial sync status from Electron IPC ─────────────────────────────
async function initSyncStatus() {
  if (!isElectron) return;
  try {
    const status = await window.electronAPI.getSyncStatus();
    _applySyncStatus(status);
  } catch {}

  // Subscribe to push updates
  _unsubSyncStatus = window.electronAPI.onSyncStatus((status) => {
    _applySyncStatus(status);
  });
}

function _applySyncStatus(status) {
  if (!status) return;
  isOnline.value = status.isOnline ?? navigator.onLine;
  syncing.value = status.syncing ?? false;
  lastSyncTime.value = status.lastSyncTime ?? null;
  pendingCount.value = status.pendingCount ?? 0;
}

// ── Network events (browser / non-Electron fallback) ──────────────────────
function updateOnlineStatus() {
  const online = navigator.onLine;
  isOnline.value = online;

  if (online && isElectron) {
    window.electronAPI.syncNow();
  }
}

// ── Manual sync ───────────────────────────────────────────────────────────
function triggerSync() {
  if (isElectron) window.electronAPI.syncNow();
}

// ── Force logout ──────────────────────────────────────────────────────────
function doForceLogout() {
  forceLogoutVisible.value = false;
  auth.logout();
  router.push("/login");
}

function setupForceLogoutListener() {
  if (!auth.isLoggedIn) return;
  const socket = getSocket();
  connectSocket(auth.user?.id, auth.user?.role, auth.user?.school_id);
  socket.on("force_logout", (data) => {
    forceLogoutMessage.value =
      data?.message || "Your school has been deactivated.";
    forceLogoutVisible.value = true;
    setTimeout(doForceLogout, 5000);
  });
}

// ── Bootstrap Electron auto-sync on existing session ──────────────────────
function checkInitialAuth() {
  if (auth.isLoggedIn && isElectron) {
    const token = localStorage.getItem("esa_token");
    const apiUrl =
      localStorage.getItem("esa_backend_url") ||
      "https://esa-system.onrender.com/api";
    window.electronAPI.userLoggedIn({ user: auth.user, token, apiUrl });
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(async () => {
  setupForceLogoutListener();
  checkInitialAuth();
  await initSyncStatus();
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
});

onUnmounted(() => {
  try {
    getSocket()?.off("force_logout");
  } catch (_) {}
  window.removeEventListener("online", updateOnlineStatus);
  window.removeEventListener("offline", updateOnlineStatus);
  if (_unsubSyncStatus) _unsubSyncStatus();
});
</script>

<style scoped>
/* ── Status Banner ───────────────────────────────────────────────────────── */
.esa-status-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10000;
  padding: 0 16px;
  height: 75px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.25);
  transition: background 0.3s ease;
}

.banner--offline {
  background: linear-gradient(90deg, #d97706, #b45309);
  color: #fff;
}

.banner--syncing {
  background: linear-gradient(90deg, #2563eb, #1d4ed8);
  color: #fff;
}

.banner-inner {
  display: flex;
  align-items: center;
  gap: 9px;
}

.banner-icon {
  font-size: 15px;
  line-height: 1;
}
.banner-text {
  font-size: 13px;
}

/* Spinning loader */
.banner-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
  flex-shrink: 0;
}

.banner-sync-btn {
  margin-left: 8px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 700;
  border: 1.5px solid rgba(255, 255, 255, 0.6);
  border-radius: 6px;
  background: transparent;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s;
  font-family: inherit;
}
.banner-sync-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.global-wa-fab {
  position: fixed;
  left: max(16px, env(safe-area-inset-left));
  bottom: max(20px, env(safe-area-inset-bottom));
  z-index: 8500;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #25d366;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 22px rgba(37, 211, 102, 0.45);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}
.global-wa-fab:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 10px 30px rgba(37, 211, 102, 0.6);
}
.global-wa-fab:active {
  transform: scale(0.96);
}
.global-wa-pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(37, 211, 102, 0.45);
  animation: waPulse 2s ease-in-out infinite;
}
@keyframes waPulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.55;
  }
  50% {
    transform: scale(1.35);
    opacity: 0;
  }
}
@media (max-width: 768px) {
  .global-wa-fab {
    width: 60px;
    height: 60px;
    left: max(12px, env(safe-area-inset-left));
    bottom: max(14px, env(safe-area-inset-bottom));
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── Transition ──────────────────────────────────────────────────────────── */
.banner-slide-enter-active,
.banner-slide-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.banner-slide-enter-from,
.banner-slide-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

/* ── Force Logout ────────────────────────────────────────────────────────── */
.force-logout-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.force-logout-modal {
  background: #1e293b;
  border: 1px solid #ef4444;
  border-radius: 20px;
  padding: 40px 36px;
  max-width: 420px;
  width: 100%;
  text-align: center;
  box-shadow: 0 25px 60px rgba(239, 68, 68, 0.3);
  animation: slideUp 0.4s ease;
}
.flm-icon {
  font-size: 52px;
  margin-bottom: 16px;
  color: #ef4444;
  font-weight: bold;
}
.force-logout-modal h2 {
  color: #ef4444;
  font-size: 22px;
  font-weight: 800;
  margin: 0 0 12px;
}
.force-logout-modal p {
  color: #94a3b8;
  font-size: 15px;
  line-height: 1.6;
  margin: 0 0 28px;
}
.flm-btn {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 14px 32px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}
.flm-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(239, 68, 68, 0.4);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
