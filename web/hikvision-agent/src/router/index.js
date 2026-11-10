import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue'),
  },
  {
    path: '/setup',
    name: 'Setup',
    component: () => import('../views/SetupView.vue'),
  },
  {
    path: '/devices',
    name: 'Devices',
    component: () => import('../views/DevicesView.vue'),
  },
  {
    path: '/esa',
    name: 'ESA',
    component: () => import('../views/ESAView.vue'),
  },
  {
    path: '/fingerprint',
    name: 'Fingerprint',
    component: () => import('../views/FingerprintView.vue'),
  },
  {
    path: '/events',
    name: 'Events',
    component: () => import('../views/EventsView.vue'),
  },
  {
    path: '/logs',
    name: 'Logs',
    component: () => import('../views/LogsView.vue'),
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue'),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to) => {
  // Could check setup status here and redirect to /setup if needed
  return true;
});

export default router;
