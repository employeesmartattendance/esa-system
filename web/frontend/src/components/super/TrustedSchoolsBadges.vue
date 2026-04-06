<template>
  <div>
    <!-- Header -->
    <div class="section-header">
      <div>
        <h2 class="section-title">Trusted Schools</h2>
        <p class="section-desc">
          Manage school badges displayed on the ESA website
        </p>
      </div>
      <button class="btn btn-primary" @click="openCreate">
        <AppIcon name="plus" :size="16" />Add School Badge
      </button>
    </div>

    <!-- Info banner -->
    <div class="info-banner glass">
      <AppIcon name="info" :size="18" color="var(--accent)" />
      <span
        >Schools listed here appear on the ESA website. Upload a logo image or
        leave blank to show initials. Names appear on hover.</span
      >
    </div>

    <!-- Loading -->
    <div v-if="loading" class="ts-empty">
      <div class="spinner"></div>
      <span style="color: var(--text-muted)">Loading...</span>
    </div>

    <!-- Empty state -->
    <div v-else-if="schools.length === 0" class="ts-empty glass">
      <AppIcon name="school" :size="36" color="var(--text-muted)" />
      <p style="color: var(--text-muted); font-size: 15px; font-weight: 600">
        No trusted school badges yet
      </p>
      <p style="color: var(--text-muted); font-size: 13px">
        Add schools to display them on the ESA website.
      </p>
      <button class="btn btn-primary" @click="openCreate">
        <AppIcon name="plus" :size="15" /> Add First School
      </button>
    </div>

    <!-- Grid of school cards -->
    <div v-else class="ts-grid">
      <div class="glass ts-card" v-for="s in schools" :key="s.id">
        <!-- Logo / initials -->
        <div class="ts-badge-preview">
          <img
            v-if="s.logo_url && !brokenLogos.has(s.id)"
            :src="toDisplayUrl(s.logo_url)"
            :alt="s.name"
            class="ts-logo"
            @error="brokenLogos.add(s.id)"
          />
          <div v-else class="ts-initial">{{ initials(s.name) }}</div>
        </div>

        <div class="ts-info">
          <div class="ts-name">{{ s.name }}</div>
          <div class="ts-meta">
            <span
              class="ts-badge-status"
              :class="s.is_active ? 'active' : 'inactive'"
            >
              {{ s.is_active ? "Visible" : "Hidden" }}
            </span>
            <span class="ts-order">Order: {{ s.sort_order }}</span>
          </div>
        </div>

        <div class="ts-actions">
          <button class="btn btn-ghost btn-sm" @click.stop="openEdit(s)">
            <AppIcon name="edit" :size="13" />Edit
          </button>
          <button class="btn-danger-soft" @click.stop="confirmDelete(s)">
            <AppIcon name="trash" :size="13" />
          </button>
        </div>
      </div>
    </div>

    <!-- ── CREATE / EDIT MODAL ── -->
    <AppModal
      v-model="showModal"
      :title="editMode ? 'Edit School Badge' : 'Add School Badge'"
      icon="school"
      max-width="500px"
    >
      <div style="display: flex; flex-direction: column; gap: 18px">
        <!-- Name -->
        <div class="form-group">
          <label class="form-label">School Name *</label>
          <input
            class="form-input"
            v-model="form.name"
            placeholder="e.g. Green Hills Academy"
            @keyup.enter="saveSchool"
          />
        </div>

        <!-- Logo drag & drop -->
        <div class="form-group">
          <label class="form-label">
            School Logo
            <span style="font-weight: 400; color: var(--text-muted)"
              >(optional)</span
            >
          </label>

          <div
            class="drop-zone"
            :class="{ 'drop-over': isDragOver, 'has-file': previewSrc }"
            @dragenter.prevent="isDragOver = true"
            @dragleave.prevent="isDragOver = false"
            @dragover.prevent="isDragOver = true"
            @drop.prevent="onDrop"
            @click="$refs.fileInput.click()"
          >
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              style="display: none"
              @change="onFileChange"
            />

            <!-- Has preview -->
            <div v-if="previewSrc" class="drop-preview">
              <img :src="previewSrc" class="drop-img" alt="Logo preview" />
              <div class="drop-preview-info">
                <span class="drop-filename">{{
                  selectedFile?.name || "Current logo"
                }}</span>
                <button
                  type="button"
                  class="drop-remove"
                  @click.stop="clearFile"
                >
                  <AppIcon name="close" :size="13" />Remove
                </button>
              </div>
            </div>

            <!-- Empty -->
            <div v-else class="drop-placeholder">
              <div class="drop-icon">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--primary)"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div class="drop-text">
                <strong>Drag &amp; drop logo here</strong>
                <span>or click to browse — PNG, JPG, SVG up to 5MB</span>
              </div>
            </div>
          </div>

          <div v-if="uploading" class="upload-progress">
            <div class="upload-bar" :style="`width:${uploadProgress}%`"></div>
          </div>
          <span
            v-if="uploadError"
            class="form-hint"
            style="color: var(--danger)"
            >{{ uploadError }}</span
          >
        </div>

        <!-- Live preview -->
        <div class="logo-preview glass">
          <span class="form-hint" style="margin-bottom: 10px; display: block"
            >Live Preview</span
          >
          <div class="preview-badge">
            <img
              v-if="previewSrc"
              :src="previewSrc"
              alt="preview"
              style="max-width: 80px; max-height: 44px; object-fit: contain"
            />
            <div
              v-else-if="form.name"
              class="ts-initial"
              style="font-size: 22px"
            >
              {{ initials(form.name) }}
            </div>
            <div
              v-else
              class="ts-initial"
              style="font-size: 22px; color: var(--text-muted)"
            >
              ?
            </div>
          </div>
          <div
            style="
              font-size: 12px;
              color: var(--text-muted);
              margin-top: 8px;
              font-weight: 600;
            "
          >
            {{ form.name || "School Name" }}
          </div>
        </div>

        <!-- Sort + Visibility -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Sort Order</label>
            <input
              class="form-input"
              type="number"
              v-model.number="form.sort_order"
              min="0"
              placeholder="0"
            />
            <span class="form-hint">Lower = appears first</span>
          </div>
          <div class="form-group">
            <label class="form-label">Visibility</label>
            <div class="toggle-wrap">
              <label class="toggle-switch">
                <input type="checkbox" v-model="form.is_active" />
                <span class="toggle-slider"></span>
              </label>
              <span style="font-size: 14px; font-weight: 600">
                {{ form.is_active ? "Visible on website" : "Hidden" }}
              </span>
            </div>
          </div>
        </div>

        <!-- Footer buttons -->
        <div class="modal-footer-btns">
          <button class="btn btn-ghost" @click="closeModal">Cancel</button>
          <button
            class="btn btn-primary"
            style="flex: 1; padding: 13px"
            :disabled="saving || !form.name.trim()"
            @click="saveSchool"
          >
            <div
              v-if="saving"
              class="spinner"
              style="
                width: 16px;
                height: 16px;
                border-color: rgba(255, 255, 255, 0.3);
                border-top-color: #fff;
              "
            ></div>
            <AppIcon v-else name="check" :size="16" />
            {{
              saving
                ? "Saving…"
                : editMode
                  ? "Save Changes"
                  : "Add School Badge"
            }}
          </button>
        </div>
      </div>
    </AppModal>

    <!-- ── DELETE CONFIRMATION MODAL ── -->
    <AppModal
      v-model="showDeleteModal"
      title="Remove School Badge"
      icon="trash"
      max-width="420px"
    >
      <div
        v-if="deleteTarget"
        style="display: flex; flex-direction: column; gap: 20px"
      >
        <div class="delete-confirm-body">
          <!-- School logo/initials preview -->
          <div class="delete-school-preview">
            <img
              v-if="deleteTarget.logo_url && !brokenLogos.has(deleteTarget.id)"
              :src="toDisplayUrl(deleteTarget.logo_url)"
              :alt="deleteTarget.name"
              class="delete-school-img"
              @error="brokenLogos.add(deleteTarget.id)"
            />
            <div v-else class="delete-school-initial">
              {{ initials(deleteTarget.name) }}
            </div>
          </div>
          <div>
            <p style="font-size: 15px; font-weight: 700; margin-bottom: 6px">
              {{ deleteTarget.name }}
            </p>
            <p
              style="
                font-size: 14px;
                color: var(--text-secondary);
                line-height: 1.6;
              "
            >
              This school badge will be removed from the ESA website. This
              action cannot be undone.
            </p>
          </div>
        </div>

        <div class="modal-footer-btns">
          <button class="btn btn-ghost" @click="showDeleteModal = false">
            Cancel
          </button>
          <button
            class="btn btn-danger"
            style="flex: 1; padding: 12px"
            :disabled="deleting"
            @click="doDelete"
          >
            <div
              v-if="deleting"
              class="spinner"
              style="
                width: 14px;
                height: 14px;
                border-color: rgba(255, 255, 255, 0.3);
                border-top-color: #fff;
              "
            ></div>
            <AppIcon v-else name="trash" :size="15" />
            {{ deleting ? "Removing…" : "Yes, Remove" }}
          </button>
        </div>
      </div>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import AppIcon from "../ui/AppIcon.vue";
import AppModal from "../ui/AppModal.vue";
import api from "../../api";
import { useToast } from "../../composables/useToast";

const { showToast } = useToast();
const API =
  import.meta.env.VITE_API_URL || "https://esa-system.onrender.com/api";
const apiBase = API.replace(/\/api\/?$/, "");

// ── State ──────────────────────────────────────────────────────────────────
const schools = ref([]);
const loading = ref(false);
const brokenLogos = reactive(new Set()); // tracks IDs of cards with broken logos

// Create/Edit modal
const showModal = ref(false);
const editMode = ref(false);
const editId = ref(null);
const saving = ref(false);

// Delete confirmation modal
const showDeleteModal = ref(false);
const deleteTarget = ref(null);
const deleting = ref(false);

// File upload
const fileInput = ref(null);
const selectedFile = ref(null);
const previewSrc = ref(""); // data-URL for new file, or full URL for existing
const isDragOver = ref(false);
const uploading = ref(false);
const uploadProgress = ref(0);
const uploadError = ref("");
const savedLogoUrl = ref(""); // the stored /uploads/... path from server

const defaultForm = () => ({ name: "", sort_order: 0, is_active: true });
const form = ref(defaultForm());

onMounted(load);

// ── Helpers ────────────────────────────────────────────────────────────────
/**
 * Convert a stored logo_url (relative /uploads/... or absolute http://...)
 * to a URL the browser can use.
 * In dev, the Vite proxy maps /uploads → localhost:3000/uploads, so relative paths work directly.
 * We keep this passthrough for the dashboard (proxy handles it).
 */
function toDisplayUrl(url) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("//")) return url;
  return `${apiBase}${url.startsWith("/") ? url : `/${url}`}`;
}

function initials(name) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ── Data ───────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true;
  try {
    const r = await api.get("/super/trusted-schools");
    schools.value = Array.isArray(r) ? r : [];
    // Reset broken set on reload
    brokenLogos.clear();
  } catch {
    showToast({ type: "error", message: "Failed to load trusted schools" });
  } finally {
    loading.value = false;
  }
}

// ── File handling ──────────────────────────────────────────────────────────
function clearFile() {
  selectedFile.value = null;
  previewSrc.value = "";
  savedLogoUrl.value = "";
  uploadError.value = "";
  uploadProgress.value = 0;
  if (fileInput.value) fileInput.value.value = "";
}

function onFileChange(e) {
  const file = e.target.files[0];
  if (file) handleFile(file);
}

function onDrop(e) {
  isDragOver.value = false;
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
}

function handleFile(file) {
  uploadError.value = "";
  if (!file.type.startsWith("image/")) {
    uploadError.value = "Only image files are allowed (PNG, JPG, SVG)";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    uploadError.value = "File size must be under 5MB";
    return;
  }
  selectedFile.value = file;
  savedLogoUrl.value = ""; // will be uploaded on save

  const reader = new FileReader();
  reader.onload = (ev) => {
    previewSrc.value = ev.target.result;
  };
  reader.readAsDataURL(file);
}

async function uploadLogo() {
  if (!selectedFile.value) return savedLogoUrl.value || null;
  uploading.value = true;
  uploadProgress.value = 0;

  try {
    const fd = new FormData();
    fd.append("logo", selectedFile.value);

    const timer = setInterval(() => {
      if (uploadProgress.value < 85) uploadProgress.value += 15;
    }, 100);

    const r = await api.post("/super/trusted-schools/upload-logo", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    clearInterval(timer);
    uploadProgress.value = 100;
    return r?.logo_url || null;
  } catch {
    uploadError.value =
      "Logo upload failed. School will be saved without a logo.";
    return null;
  } finally {
    uploading.value = false;
  }
}

// ── Modal open/close ───────────────────────────────────────────────────────
function openCreate() {
  form.value = defaultForm();
  editMode.value = false;
  editId.value = null;
  clearFile();
  showModal.value = true;
}

function openEdit(s) {
  form.value = {
    name: s.name,
    sort_order: s.sort_order ?? 0,
    is_active: !!s.is_active,
  };
  editId.value = s.id;
  editMode.value = true;

  // Load existing logo into preview
  if (s.logo_url) {
    savedLogoUrl.value = s.logo_url; // keep reference to stored path
    previewSrc.value = toDisplayUrl(s.logo_url); // show in drop-zone + preview
    selectedFile.value = null; // no NEW file selected yet
  } else {
    clearFile();
  }

  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  // Small delay so the close animation finishes before resetting state
  setTimeout(() => {
    form.value = defaultForm();
    editMode.value = false;
    editId.value = null;
    clearFile();
  }, 300);
}

// ── Save ───────────────────────────────────────────────────────────────────
async function saveSchool() {
  if (!form.value.name.trim()) return;
  saving.value = true;
  let saved = false;
  try {
    // Upload new file if one was selected
    let logoUrl = selectedFile.value
      ? await uploadLogo()
      : savedLogoUrl.value || null;

    const payload = {
      name: form.value.name.trim(),
      logo_url: logoUrl,
      sort_order: form.value.sort_order,
      is_active: form.value.is_active,
    };

    if (editMode.value) {
      await api.put(`/super/trusted-schools/${editId.value}`, payload);
      const idx = schools.value.findIndex((s) => s.id === editId.value);
      if (idx !== -1) {
        schools.value[idx] = { ...schools.value[idx], ...payload };
        brokenLogos.delete(editId.value);
      }
    } else {
      const r = await api.post("/super/trusted-schools", payload);
      const newId = r?.id ?? Date.now();
      schools.value.push({ id: newId, ...payload });
    }

    saved = true;
    showToast({
      type: "success",
      message: editMode.value ? "School badge updated" : "School badge added",
    });
  } catch {
    showToast({ type: "error", message: "Save failed. Please try again." });
  } finally {
    saving.value = false;
    if (saved) closeModal(); // always close after confirmed save
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────
function confirmDelete(school) {
  deleteTarget.value = school;
  showDeleteModal.value = true;
}

async function doDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  let deleted = false;
  const name = deleteTarget.value.name;
  try {
    await api.delete(`/super/trusted-schools/${deleteTarget.value.id}`);
    schools.value = schools.value.filter((s) => s.id !== deleteTarget.value.id);
    deleted = true;
    showToast({ type: "success", message: `"${name}" removed` });
  } catch {
    showToast({ type: "error", message: "Delete failed" });
  } finally {
    deleting.value = false;
    if (deleted) {
      showDeleteModal.value = false;
      deleteTarget.value = null;
    }
  }
}
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────────────────── */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}
.section-title {
  font-size: 22px;
  font-weight: 800;
}
.section-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 2px;
}

.info-banner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 18px;
  border-radius: var(--radius);
  margin-bottom: 20px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.65;
  border-left: 3px solid var(--accent);
}

/* ── Cards grid ─────────────────────────────────────────────────────────── */
.ts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.ts-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: var(--radius-lg);
  transition: all var(--transition);
}
.ts-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--card-shadow-lg);
}

.ts-badge-preview {
  width: 64px;
  height: 48px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border: 1px solid var(--surface-border);
  overflow: hidden;
}
.ts-logo {
  max-width: 56px;
  max-height: 40px;
  object-fit: contain;
  display: block;
}
.ts-initial {
  font-size: 20px;
  font-weight: 800;
  color: var(--primary);
}

.ts-info {
  flex: 1;
  min-width: 0;
}
.ts-name {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ts-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ts-badge-status {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 99px;
  text-transform: uppercase;
}
.ts-badge-status.active {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success);
}
.ts-badge-status.inactive {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}
.ts-order {
  font-size: 11px;
  color: var(--text-muted);
}

.ts-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.btn-danger-soft {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  cursor: pointer;
  transition: all var(--transition);
  gap: 4px;
  font-family: var(--font);
}
.btn-danger-soft:hover {
  background: var(--danger);
  color: #fff;
}

.ts-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 64px 32px;
  text-align: center;
  border-radius: var(--radius-xl);
}

/* ── Drop zone ──────────────────────────────────────────────────────────── */
.drop-zone {
  border: 2px dashed var(--surface-border);
  border-radius: var(--radius);
  background: var(--bg);
  cursor: pointer;
  transition: all var(--transition);
  min-height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.drop-zone:hover,
.drop-zone.drop-over {
  border-color: var(--primary);
  background: rgba(37, 99, 235, 0.04);
}
.drop-zone.has-file {
  border-style: solid;
  border-color: var(--success);
  background: rgba(16, 185, 129, 0.04);
}

.drop-placeholder {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  width: 100%;
}
.drop-icon {
  width: 52px;
  height: 52px;
  background: rgba(37, 99, 235, 0.1);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.drop-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.drop-text strong {
  font-size: 14px;
  color: var(--text);
}
.drop-text span {
  font-size: 12px;
  color: var(--text-muted);
}

.drop-preview {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  width: 100%;
}
.drop-img {
  width: 60px;
  height: 44px;
  object-fit: contain;
  border-radius: var(--radius-sm);
  border: 1px solid var(--surface-border);
}
.drop-preview-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.drop-filename {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text);
}
.drop-remove {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--danger);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  font-family: var(--font);
}
.drop-remove:hover {
  text-decoration: underline;
}

.upload-progress {
  height: 4px;
  background: var(--bg-secondary);
  border-radius: 99px;
  overflow: hidden;
  margin-top: 6px;
}
.upload-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--accent));
  border-radius: 99px;
  transition: width 0.3s ease;
}

/* ── Modal form ─────────────────────────────────────────────────────────── */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}
.form-input {
  padding: 11px 14px;
  background: var(--bg);
  border: 1.5px solid var(--surface-border);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 14px;
  font-family: var(--font);
  outline: none;
  transition: all var(--transition);
}
.form-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-glow);
}
.form-hint {
  font-size: 11px;
  color: var(--text-muted);
}
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.logo-preview {
  padding: 16px;
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.preview-badge {
  width: 110px;
  height: 68px;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
  border: 1px solid var(--surface-border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.toggle-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}
.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
  display: block;
}
.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}
.toggle-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--text-muted);
  border-radius: 99px;
  transition: 0.3s;
  cursor: pointer;
}
.toggle-slider::before {
  content: "";
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  bottom: 3px;
  background: #fff;
  border-radius: 50%;
  transition: 0.3s;
}
input:checked + .toggle-slider {
  background: var(--primary);
}
input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.modal-footer-btns {
  display: flex;
  gap: 10px;
  padding-top: 4px;
}

/* ── Delete confirmation ─────────────────────────────────────────────────── */
.delete-confirm-body {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}
.delete-school-preview {
  width: 72px;
  height: 56px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border: 1px solid var(--surface-border);
  overflow: hidden;
}
.delete-school-img {
  max-width: 60px;
  max-height: 44px;
  object-fit: contain;
  display: block;
}
.delete-school-initial {
  font-size: 22px;
  font-weight: 800;
  color: var(--primary);
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */
.spinner {
  border: 2px solid rgba(37, 99, 235, 0.3);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 600px) {
  .ts-grid {
    grid-template-columns: 1fr;
  }
  .form-row {
    grid-template-columns: 1fr;
  }
  .delete-confirm-body {
    flex-direction: column;
    text-align: center;
  }
  .ts-badge-preview {
    display: none !important;
  }
}
</style>
