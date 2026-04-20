import { createRouter, createWebHashHistory } from 'vue-router';
import SyncView from '../views/SyncView.vue';
import TasksView from '../views/TasksView.vue';
import LoginView from '../views/LoginView.vue';
import SettingsView from '../views/SettingsView.vue';
import { authenticated, configured, checkStatus } from '../composables/useApi';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: SyncView },
    { path: '/tasks', component: TasksView },
    { path: '/settings', component: SettingsView },
    { path: '/login', component: LoginView },
  ],
});

router.beforeEach(async (to) => {
  if (configured.value === null || authenticated.value === null) {
    await checkStatus();
  }

  if (!configured.value) {
    if (to.path === '/login') {
      return '/settings';
    }
    if (to.path !== '/settings') {
      return '/settings';
    }
    return true;
  }

  if (!authenticated.value) {
    if (to.path === '/login') {
      return true;
    }
    return { path: '/login', query: { redirect: to.fullPath } };
  }

  if (to.path === '/login') {
    return '/';
  }

  if (to.path === '/settings' || to.path === '/' || to.path === '/tasks') {
    return true;
  }

  if (!configured.value) {
    return '/settings';
  }
});

export default router;
