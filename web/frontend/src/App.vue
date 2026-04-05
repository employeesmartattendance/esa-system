<template>
  <RouterView />

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
import { RouterView, useRouter } from "vue-router";
import { useDark } from "./composables/useDark";
import { useAuthStore } from "./stores/auth";
import { getSocket, connectSocket } from "./socket";

const { isDark } = useDark();
const auth = useAuthStore();
const router = useRouter();

const isElectron = !!window.electronAPI;
const forceLogoutVisible = ref(false);
const forceLogoutMessage = ref("");

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
