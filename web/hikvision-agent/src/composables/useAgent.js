/**
 * Reactive Agent State Composable
 * Bridges IPC calls to the Vue reactive system
 */
import { ref, reactive, onMounted, onUnmounted } from 'vue';

const agentStatus = reactive({
  running: false,
  deviceStatus: 'disconnected',
  esaStatus: 'disconnected',
  commandsInFlight: false,
  stats: {
    commandsProcessed: 0,
    eventsReported: 0,
    errors: 0,
    lastCommandAt: null,
    lastEventAt: null,
    lastConfigRefresh: null,
    lastErrorAt: null,
    uptimeStart: null,
    consecutiveErrors: 0,
  },
  syncQueue: { pending: 0, oldestItem: null, newestItem: null, totalRetries: 0 },
  enrollments: [],
  deviceSource: 'manual',
  cachedDeviceHost: null,
});

const loading = ref(false);
const error = ref(null);

let cleanupFns = [];

export function useAgent() {
  async function fetchStatus() {
    try {
      const status = await window.agentAPI.agent.getStatus();
      Object.assign(agentStatus, status);
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  }

  async function startAgent() {
    loading.value = true;
    error.value = null;
    try {
      const result = await window.agentAPI.agent.start();
      if (!result.ok) error.value = result.message;
      await fetchStatus();
      return result;
    } catch (err) {
      error.value = err.message;
      return { ok: false, message: err.message };
    } finally {
      loading.value = false;
    }
  }

  async function stopAgent() {
    loading.value = true;
    try {
      const result = await window.agentAPI.agent.stop();
      await fetchStatus();
      return result;
    } catch (err) {
      error.value = err.message;
      return { ok: false, message: err.message };
    } finally {
      loading.value = false;
    }
  }

  async function restartAgent() {
    loading.value = true;
    try {
      const result = await window.agentAPI.agent.restart();
      await fetchStatus();
      return result;
    } catch (err) {
      error.value = err.message;
      return { ok: false, message: err.message };
    } finally {
      loading.value = false;
    }
  }

  function setupPushListeners() {
    const unsubStatus = window.agentAPI.agent.onStatusPush((status) => {
      Object.assign(agentStatus, status);
    });

    const unsubEnrollment = window.agentAPI.fingerprint.onEnrollmentPush((enrollments) => {
      agentStatus.enrollments = enrollments;
    });

    cleanupFns.push(unsubStatus, unsubEnrollment);
  }

  onMounted(() => {
    fetchStatus();
    setupPushListeners();
  });

  onUnmounted(() => {
    for (const fn of cleanupFns) fn();
    cleanupFns = [];
  });

  return {
    agentStatus,
    loading,
    error,
    fetchStatus,
    startAgent,
    stopAgent,
    restartAgent,
  };
}
