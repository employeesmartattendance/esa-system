import { defineStore } from "pinia";
import { ref, computed } from "vue";
import api from "../api";

// Token expiry: 30 days in milliseconds
const TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export const useAuthStore = defineStore("auth", () => {
  const token = ref(localStorage.getItem("esa_token") || null);
  const user = ref(JSON.parse(localStorage.getItem("esa_user") || "null"));
  const loginTime = ref(
    parseInt(localStorage.getItem("esa_login_time") || "0"),
  );
  const loading = ref(false);

  const isLoggedIn = computed(() => {
    if (!token.value) return false;
    if (loginTime.value && Date.now() - loginTime.value > TOKEN_LIFETIME_MS) {
      return false;
    }
    return true;
  });

  const isSuperAdmin = computed(() => user.value?.role === "super_admin");
  const isSchoolAdmin = computed(() => user.value?.role === "school_admin");
  const isTeacher = computed(() => user.value?.role === "teacher");
  const schoolId = computed(() => user.value?.school_id);

  const daysRemaining = computed(() => {
    if (!loginTime.value || !token.value) return 0;
    const elapsed = Date.now() - loginTime.value;
    return Math.max(
      0,
      Math.ceil((TOKEN_LIFETIME_MS - elapsed) / (24 * 60 * 60 * 1000)),
    );
  });

  function _clearSession() {
    token.value = null;
    user.value = null;
    loginTime.value = 0;
    localStorage.removeItem("esa_token");
    localStorage.removeItem("esa_user");
    localStorage.removeItem("esa_login_time");
  }

  async function login(email, password) {
    loading.value = true;
    try {
      // api.js response interceptor unwraps the { success, data, message } envelope,
      // so the resolved value is already the inner data object: { token, user }
      const res = await api.post("/auth/login", { email, password });
      // res may be the unwrapped payload directly, or still wrapped depending on
      // the interceptor path — handle both cases defensively
      const payload =
        res && res.token ? res : res?.data?.token ? res.data : res?.data || res;
      const t = payload?.token;
      const u = payload?.user;
      if (!t || !u)
        throw new Error("Invalid server response — no token or user returned");

      const now = Date.now();
      token.value = t;
      user.value = u;
      loginTime.value = now;

      localStorage.setItem("esa_token", t);
      localStorage.setItem("esa_user", JSON.stringify(u));
      localStorage.setItem("esa_login_time", String(now));

      // Notify Electron for offline sync
      if (window.electronAPI) {
        const apiUrl =
          localStorage.getItem("esa_backend_url") ||
          "https://esasystem.onrender.com/api";
        window.electronAPI.userLoggedIn({ user: u, token: t, apiUrl });
      }

      return u;
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Login failed";
      throw new Error(msg);
    } finally {
      loading.value = false;
    }
  }

  async function fetchMe() {
    try {
      // api.js interceptor unwraps envelope — res is the user object directly
      const res = await api.get("/auth/me");
      user.value =
        res && typeof res === "object" && !Array.isArray(res)
          ? res
          : (res?.data ?? res);
      localStorage.setItem("esa_user", JSON.stringify(user.value));
    } catch (_) {
      _clearSession();
    }
  }

  function logout() {
    _clearSession();
  }

  return {
    token,
    user,
    loginTime,
    loading,
    isLoggedIn,
    isSuperAdmin,
    isSchoolAdmin,
    isTeacher,
    schoolId,
    daysRemaining,
    login,
    fetchMe,
    logout,
  };
});
