import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/website',
    name: 'Website',
    component: () => import('../views/WebsiteView.vue'),
    meta: { guest: true },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true },
  },

  // ── Super Admin ──────────────────────────────────────────────────────────
  {
    path: '/super',
    redirect: '/super/dashboard',
  },
  {
    path: '/super/dashboard',
    name: 'SuperDashboard',
    component: () => import('../views/SuperAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'super_admin' },
  },
  {
    path: '/super/schools',
    name: 'SuperSchools',
    component: () => import('../views/SuperAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'super_admin' },
  },
  {
    path: '/super/logs',
    name: 'SuperLogs',
    component: () => import('../views/SuperAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'super_admin' },
  },
  {
    path: '/super/settings',
    name: 'SuperSettings',
    component: () => import('../views/SuperAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'super_admin' },
  },
  {
    path: '/super/contact-requests',
    name: 'SuperContactRequests',
    component: () => import('../views/SuperAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'super_admin' },
  },
  {
    path: '/super/trusted-schools',
    name: 'SuperTrustedSchools',
    component: () => import('../views/SuperAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'super_admin' },
  },

  // ── School Admin ─────────────────────────────────────────────────────────
  {
    path: '/school',
    redirect: '/school/dashboard',
  },
  {
    path: '/school/dashboard',
    name: 'SchoolDashboard',
    component: () => import('../views/SchoolAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'school_admin' },
  },
  {
    path: '/school/teachers',
    name: 'SchoolTeachers',
    component: () => import('../views/SchoolAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'school_admin' },
  },
  {
    path: '/school/attendance',
    name: 'SchoolAttendance',
    component: () => import('../views/SchoolAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'school_admin' },
  },
  {
    path: '/school/settings',
    name: 'SchoolSettings',
    component: () => import('../views/SchoolAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'school_admin' },
  },
  {
    path: '/school/reports',
    name: 'SchoolReports',
    component: () => import('../views/SchoolAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'school_admin' },
  },

  // ── Teacher ──────────────────────────────────────────────────────────────
  {
    path: '/teacher',
    redirect: '/teacher/dashboard',
  },
  {
    path: '/teacher/dashboard',
    name: 'TeacherDashboard',
    component: () => import('../views/TeacherDashboard.vue'),
    meta: { requiresAuth: true, role: 'teacher' },
  },
  {
    path: '/teacher/map',
    name: 'TeacherMap',
    component: () => import('../views/TeacherDashboard.vue'),
    meta: { requiresAuth: true, role: 'teacher' },
  },
  {
    path: '/teacher/history',
    name: 'TeacherHistory',
    component: () => import('../views/TeacherDashboard.vue'),
    meta: { requiresAuth: true, role: 'teacher' },
  },
  {
    path: '/teacher/profile',
    name: 'TeacherProfile',
    component: () => import('../views/TeacherDashboard.vue'),
    meta: { requiresAuth: true, role: 'teacher' },
  },

  // ── Fallback ─────────────────────────────────────────────────────────────
  { path: '/:pathMatch(.*)*', redirect: '/login' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() { return { top: 0 } },
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()

  // Clean up expired session before any navigation decision (side-effect safe here)
  if (auth.token && auth.loginTime && Date.now() - auth.loginTime > 30 * 24 * 60 * 60 * 1000) {
    auth.logout()
  }

  if (to.meta.guest) {
    // If already logged in (session still valid), go straight to dashboard
    if (auth.isLoggedIn) return next(getRoleRoot(auth.user?.role))
    return next()
  }

  if (to.meta.requiresAuth) {
    if (!auth.isLoggedIn) {
      // Session expired or not logged in — go to login
      return next('/login')
    }
    if (to.meta.role && auth.user?.role !== to.meta.role) {
      return next(getRoleRoot(auth.user?.role))
    }
    return next()
  }

  next()
})

function getRoleRoot(role) {
  if (role === 'super_admin') return '/super/dashboard'
  if (role === 'school_admin') return '/school/dashboard'
  if (role === 'teacher') return '/teacher/dashboard'
  return '/login'
}

export default router
