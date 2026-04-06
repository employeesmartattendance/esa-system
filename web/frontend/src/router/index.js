import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    redirect: '/website',
  },
  {
    path: '/website',
    name: 'Website',
    component: () => import('../views/WebsiteView.vue'),
    meta: {
      guest: true,
      title: 'ESA Attendance System for Schools | GPS Teacher Attendance Tracking',
      description: 'ESA is an employee smart attendance system for schools with GPS geolocation, Wi-Fi validation, real-time dashboard, and automated attendance reports.',
      robots: 'index,follow',
    },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: {
      guest: true,
      title: 'ESA Login | Employee Smart Attendance System',
      description: 'Sign in to ESA attendance system to manage school attendance, GPS-based check-ins, and live attendance reports.',
      robots: 'index,follow',
    },
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
    meta: { requiresAuth: true, role: 'super_admin', title: 'Super Admin Dashboard | ESA', robots: 'noindex,nofollow' },
  },
  {
    path: '/super/schools',
    name: 'SuperSchools',
    component: () => import('../views/SuperAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'super_admin', title: 'Schools Management | ESA', robots: 'noindex,nofollow' },
  },
  {
    path: '/super/logs',
    name: 'SuperLogs',
    component: () => import('../views/SuperAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'super_admin', title: 'System Logs | ESA', robots: 'noindex,nofollow' },
  },
  {
    path: '/super/settings',
    name: 'SuperSettings',
    component: () => import('../views/SuperAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'super_admin', title: 'Platform Settings | ESA', robots: 'noindex,nofollow' },
  },
  {
    path: '/super/contact-requests',
    name: 'SuperContactRequests',
    component: () => import('../views/SuperAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'super_admin', title: 'Contact Requests | ESA', robots: 'noindex,nofollow' },
  },
  {
    path: '/super/trusted-schools',
    name: 'SuperTrustedSchools',
    component: () => import('../views/SuperAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'super_admin', title: 'Trusted Schools | ESA', robots: 'noindex,nofollow' },
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
    meta: { requiresAuth: true, role: 'school_admin', title: 'School Dashboard | ESA', robots: 'noindex,nofollow' },
  },
  {
    path: '/school/teachers',
    name: 'SchoolTeachers',
    component: () => import('../views/SchoolAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'school_admin', title: 'Teacher Management | ESA', robots: 'noindex,nofollow' },
  },
  {
    path: '/school/attendance',
    name: 'SchoolAttendance',
    component: () => import('../views/SchoolAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'school_admin', title: 'Attendance Monitoring | ESA', robots: 'noindex,nofollow' },
  },
  {
    path: '/school/settings',
    name: 'SchoolSettings',
    component: () => import('../views/SchoolAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'school_admin', title: 'School Settings | ESA', robots: 'noindex,nofollow' },
  },
  {
    path: '/school/reports',
    name: 'SchoolReports',
    component: () => import('../views/SchoolAdminDashboard.vue'),
    meta: { requiresAuth: true, role: 'school_admin', title: 'Attendance Reports | ESA', robots: 'noindex,nofollow' },
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
    meta: { requiresAuth: true, role: 'teacher', title: 'Teacher Dashboard | ESA', robots: 'noindex,nofollow' },
  },
  {
    path: '/teacher/map',
    name: 'TeacherMap',
    component: () => import('../views/TeacherDashboard.vue'),
    meta: { requiresAuth: true, role: 'teacher', title: 'Teacher Live Map | ESA', robots: 'noindex,nofollow' },
  },
  {
    path: '/teacher/history',
    name: 'TeacherHistory',
    component: () => import('../views/TeacherDashboard.vue'),
    meta: { requiresAuth: true, role: 'teacher', title: 'Attendance History | ESA', robots: 'noindex,nofollow' },
  },
  {
    path: '/teacher/profile',
    name: 'TeacherProfile',
    component: () => import('../views/TeacherDashboard.vue'),
    meta: { requiresAuth: true, role: 'teacher', title: 'Teacher Profile | ESA', robots: 'noindex,nofollow' },
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
  const refreshFlagKey = 'esa_dashboard_refresh_pending'

  // Clean up expired session before any navigation decision (side-effect safe here)
  if (auth.token && auth.loginTime && Date.now() - auth.loginTime > 30 * 24 * 60 * 60 * 1000) {
    auth.logout()
  }

  if (to.meta.guest) {
    if (auth.isLoggedIn) {
      const target = getRoleRoot(auth.user?.role)
      if (sessionStorage.getItem(refreshFlagKey) !== target) {
        sessionStorage.setItem(refreshFlagKey, target)
        window.location.replace(target)
        return
      }
      sessionStorage.removeItem(refreshFlagKey)
      return next(target)
    }
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

router.afterEach((to) => {
  const defaultTitle = 'ESA Attendance System | Employee Smart Attendance'
  const defaultDescription = 'ESA attendance system for schools with GPS geolocation tracking, teacher check-in automation, and real-time attendance dashboards.'
  const title = to.meta?.title || defaultTitle
  const description = to.meta?.description || defaultDescription
  const robots = to.meta?.robots || 'index,follow'

  document.title = title

  let metaDescription = document.querySelector('meta[name="description"]')
  if (!metaDescription) {
    metaDescription = document.createElement('meta')
    metaDescription.setAttribute('name', 'description')
    document.head.appendChild(metaDescription)
  }
  metaDescription.setAttribute('content', description)

  let metaRobots = document.querySelector('meta[name="robots"]')
  if (!metaRobots) {
    metaRobots = document.createElement('meta')
    metaRobots.setAttribute('name', 'robots')
    document.head.appendChild(metaRobots)
  }
  metaRobots.setAttribute('content', robots)

  let canonical = document.querySelector('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    document.head.appendChild(canonical)
  }
  canonical.setAttribute('href', `${window.location.origin}${to.path}`)
})

export default router
