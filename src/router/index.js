import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/RegisterView.vue'),
    meta: { guest: true },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
  },
  {
    path: '/logs',
    name: 'logs',
    component: () => import('../views/LogsView.vue'),
  },
  {
    path: '/endpoints',
    name: 'endpoints',
    component: () => import('../views/EndpointsView.vue'),
  },
  {
    path: '/endpoints/new',
    name: 'endpoint-new',
    component: () => import('../views/EndpointDetailView.vue'),
  },
  {
    path: '/endpoints/:id',
    name: 'endpoint-detail',
    component: () => import('../views/EndpointDetailView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const PUBLIC_ROUTES = ['home', 'login', 'register']

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (authStore.loading) {
    await authStore.initAuth()
  }

  if (to.name === 'home') {
    return authStore.isAuthenticated ? { name: 'dashboard' } : { name: 'login' }
  }

  if (!PUBLIC_ROUTES.includes(to.name) && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guest && authStore.isAuthenticated) {
    return { name: 'dashboard' }
  }
})

export default router
