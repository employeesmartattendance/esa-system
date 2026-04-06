import axios from "axios";

/**
 * ESA API Client – Offline-First
 *
 * When running in Electron:
 *   • Online  → call API normally; Electron sync engine saves all data to SQLite
 *   • Offline → return data from local SQLite via IPC (window.electronAPI.dbQuery)
 *
 * When running in browser (no Electron):
 *   • Online  → call API normally
 *   • Offline → return null / empty arrays gracefully
 */

const isElectron = !!window.electronAPI;

// ── Base URL resolution ────────────────────────────────────────────────────────
const isLocalhostHost = (host) =>
  ["localhost", "127.0.0.1", "::1"].includes(host);

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl.endsWith("/api") ? envUrl : `${envUrl}/api`;

  const customUrl = localStorage.getItem("esa_backend_url");
  if (customUrl)
    return customUrl.endsWith("/api") ? customUrl : `${customUrl}/api`;

  if (isLocalhostHost(window.location.hostname))
    return "https://esa-system.onrender.com/api";
  return "/api";
};

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ── SQLite helpers (Electron only) ────────────────────────────────────────────
const db = {
  async query(sql, params = []) {
    if (!isElectron) return { success: false, data: [] };
    return window.electronAPI.dbQuery(sql, params);
  },
  async queueSync(endpoint, method, payload) {
    if (!isElectron) return;
    await window.electronAPI.dbQuery(
      "INSERT INTO sync_queue (endpoint, method, payload) VALUES (?, ?, ?)",
      [
        endpoint,
        method.toUpperCase(),
        typeof payload === "string" ? payload : JSON.stringify(payload),
      ],
    );
  },
};

// ── Offline SQLite data helpers ───────────────────────────────────────────────

async function _offlineFallback(url, method) {
  if (!isElectron) return null;
  url = url || "";

  if (method !== "get") return null;

  // -- Teachers
  if (url.includes("/teachers")) {
    const r = await db.query("SELECT * FROM teachers ORDER BY name ASC");
    if (r.success && r.data.length) return r.data;
  }
  // -- School settings
  if (url.includes("/school/settings") || url.includes("/settings")) {
    const r = await db.query("SELECT * FROM settings LIMIT 1");
    if (r.success && r.data.length) return r.data[0];
  }
  // -- School stats (build from attendance)
  if (url.includes("/school/stats") || url.includes("/stats")) {
    const today = new Date().toISOString().slice(0, 10);
    const r = await db.query(
      `SELECT
         COUNT(*) AS total_teachers,
         SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) AS present_today,
         SUM(CASE WHEN status='late'    THEN 1 ELSE 0 END) AS late_today,
         SUM(CASE WHEN status='absent'  THEN 1 ELSE 0 END) AS absent_today
       FROM attendance WHERE date = ?`,
      [today],
    );
    if (r.success && r.data.length) return r.data[0];
  }
  // -- Attendance list
  if (url.includes("/attendance")) {
    const r = await db.query(
      "SELECT * FROM attendance ORDER BY date DESC LIMIT 500",
    );
    if (r.success) return r.data;
  }
  // -- Reports
  if (url.includes("/reports")) {
    const r = await db.query(
      "SELECT * FROM reports ORDER BY report_date DESC LIMIT 100",
    );
    if (r.success) {
      // Parse JSON name fields
      return r.data.map((rep) => ({
        ...rep,
        present_names: _tryParseJson(rep.present_names),
        late_names: _tryParseJson(rep.late_names),
        absent_names: _tryParseJson(rep.absent_names),
      }));
    }
  }
  // -- Auth/me (return cached user)
  if (url.includes("/auth/me")) {
    try {
      return JSON.parse(localStorage.getItem("esa_user") || "null");
    } catch {
      return null;
    }
  }

  return null;
}

function _tryParseJson(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

// ── Request interceptor ───────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    config.baseURL = getBaseUrl();
    const token = localStorage.getItem("esa_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (err) => Promise.reject(err),
);

// ── Response interceptor ──────────────────────────────────────────────────────
api.interceptors.response.use(
  (res) => {
    // Unwrap standard ESA envelope { success, data, message }
    const d = res.data;
    if (d && typeof d === "object" && "success" in d && "data" in d)
      return d.data;
    return d;
  },
  async (err) => {
    const { config, response } = err;
    const method = (config?.method || "get").toLowerCase();
    const isOffline =
      !navigator.onLine || !response || err.code === "ECONNABORTED";
    const statusCode = response?.status;
    const contentType = response?.headers?.["content-type"] || "";

    const dispatchApiError = (message) => {
      window.dispatchEvent(
        new CustomEvent("esa:api-error", {
          detail: {
            message,
            url: config?.url || "",
            method,
            status: statusCode || null,
          },
        }),
      );
    };

    const deriveErrorMessage = () => {
      if (contentType.includes("text/html")) {
        return "Server returned HTML instead of JSON. Check frontend API base URL and backend route.";
      }
      return (
        response?.data?.message ||
        response?.data?.error ||
        err.message ||
        "Request failed"
      );
    };

    // 401 – session expired
    if (statusCode === 401) {
      localStorage.removeItem("esa_token");
      localStorage.removeItem("esa_user");
      setTimeout(() => {
        window.location.href = "/login";
      }, 1200);
      dispatchApiError("Your session expired. Please sign in again.");
      return Promise.reject(err);
    }

    // Offline or network error → try SQLite
    if (isOffline) {
      dispatchApiError(
        "Unable to reach the backend server. Check your network or backend URL.",
      );
      const fallback = await _offlineFallback(config?.url, method);
      if (fallback !== null) return fallback;

      // POST/PUT – queue for background sync
      if ((method === "post" || method === "put") && config) {
        await db.queueSync(config.url, method, config.data);
        return { success: true, offline_queued: true };
      }
    }

    dispatchApiError(deriveErrorMessage());
    return Promise.reject(err);
  },
);

export default api;
