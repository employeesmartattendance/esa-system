<template>
  <div class="fingerprint-view">
    <div class="page-header">
      <h1>Fingerprint Enrollment</h1>
      <button class="btn btn-primary" @click="showManual = !showManual">
        <span class="icon icon-sm" v-html="icons.plus"></span>
        {{ showManual ? 'Cancel' : 'Manual Enroll' }}
      </button>
    </div>

    <!-- Manual Enrollment Form -->
    <div class="card" v-if="showManual" style="margin-bottom: 20px;">
      <div class="card-header">
        <h3>Manual Fingerprint Enrollment</h3>
      </div>
      <div class="card-body">
        <div class="manual-form">
          <div class="input-field-row">
            <div class="input-group">
              <label>Employee Number</label>
              <input class="input-field" v-model="manualForm.employeeNo" placeholder="e.g. 507f1f77bcf86cd7" />
            </div>
            <div class="input-group" style="max-width: 140px;">
              <label>Finger Number</label>
              <select class="input-field" v-model.number="manualForm.fingerNo">
                <option :value="1">Finger 1 (Right Thumb)</option>
                <option :value="2">Finger 2 (Right Index)</option>
                <option :value="3">Finger 3</option>
                <option :value="4">Finger 4</option>
                <option :value="5">Finger 5</option>
                <option :value="6">Finger 6</option>
                <option :value="7">Finger 7</option>
                <option :value="8">Finger 8</option>
                <option :value="9">Finger 9</option>
                <option :value="10">Finger 10</option>
              </select>
            </div>
          </div>
          <button class="btn btn-primary" @click="startManualEnrollment" :disabled="manualLoading">
            <span class="spinner" v-if="manualLoading"></span>
            <span v-else>Start Capture</span>
          </button>
          <p v-if="manualResult" class="manual-result" :class="manualResult.ok ? 'success' : 'error'">
            {{ manualResult.message }}
          </p>
          <p v-if="manualLoading" class="waiting-note">
            Waiting for the employee to scan their finger on the device. This may take up to 60 seconds...
          </p>
        </div>
      </div>
    </div>

    <!-- Active Enrollments -->
    <div class="card">
      <div class="card-header">
        <h3>Enrollment Activity</h3>
        <button class="btn btn-sm" @click="refreshEnrollments">Refresh</button>
      </div>
      <div class="card-body" style="padding: 0;">
        <div v-if="enrollments.length > 0">
          <div class="enrollment-row" v-for="enr in enrollments" :key="enr.employeeNo + '-' + enr.commandId">
            <div class="enrollment-main">
              <div class="enrollment-emp">
                <span class="icon icon-sm" style="color: var(--color-accent)" v-html="icons.fingerprint"></span>
                Employee {{ enr.employeeNo }}
              </div>
              <div class="enrollment-meta">Finger #{{ enr.fingerNo }} | Started {{ formatTime(enr.startedAt) }}</div>
            </div>
            <span class="badge" :class="enrollmentBadge(enr.status)">
              <span class="spinner" v-if="enr.status === 'waiting_scan'" style="width:10px;height:10px;border-width:1.5px;"></span>
              {{ enr.status.replace('_', ' ') }}
            </span>
          </div>
        </div>
        <div v-else class="empty-state">
          <span class="icon icon-xl" v-html="icons.fingerprint"></span>
          <p>No active enrollments. Enrollments are triggered from the ESA dashboard or manually above.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import icons from '../icons/index.js';

const showManual = ref(false);
const manualLoading = ref(false);
const manualResult = ref(null);
const manualForm = reactive({ employeeNo: '', fingerNo: 1 });
const enrollments = ref([]);

let unsubEnrollment = null;

onMounted(async () => {
  enrollments.value = await window.agentAPI.fingerprint.getEnrollments();
  unsubEnrollment = window.agentAPI.fingerprint.onEnrollmentPush((list) => {
    enrollments.value = list;
  });
});

onUnmounted(() => {
  if (unsubEnrollment) unsubEnrollment();
});

async function refreshEnrollments() {
  enrollments.value = await window.agentAPI.fingerprint.getEnrollments();
}

async function startManualEnrollment() {
  if (!manualForm.employeeNo) return;
  manualLoading.value = true;
  manualResult.value = null;
  try {
    const result = await window.agentAPI.fingerprint.startEnrollment({
      employeeNo: manualForm.employeeNo,
      fingerNo: manualForm.fingerNo,
    });
    manualResult.value = result;
    if (result.ok) {
      showManual.value = false;
    }
  } catch (err) {
    manualResult.value = { ok: false, message: err.message };
  } finally {
    manualLoading.value = false;
  }
}

function enrollmentBadge(status) {
  if (status === 'enrolled') return 'badge-success';
  if (status === 'failed') return 'badge-error';
  if (status === 'capturing' || status === 'waiting_scan') return 'badge-info';
  if (status === 'registering') return 'badge-warning';
  return 'badge-info';
}

function formatTime(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return iso; }
}
</script>

<style scoped>
.fingerprint-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.page-header h1 { font-size: 22px; font-weight: 700; }
.manual-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 480px;
}
.manual-result {
  font-size: 13px;
  font-weight: 500;
}
.manual-result.success { color: var(--color-success); }
.manual-result.error { color: var(--color-error); }
.waiting-note {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-style: italic;
}
.enrollment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border-light);
}
.enrollment-row:last-child { border-bottom: none; }
.enrollment-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.enrollment-emp {
  font-weight: 600;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.enrollment-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>