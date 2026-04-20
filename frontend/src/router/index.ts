import { createRouter, createWebHashHistory } from 'vue-router';
import SyncView from '../views/SyncView.vue';
import TasksView from '../views/TasksView.vue';
import SettingsView from '../views/SettingsView.vue';
import { configured, checkStatus } from '../composables/useApi';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: SyncView, meta: { requiresConfig: true } },
    { path: '/tasks', component: TasksView, meta: { requiresConfig: true } },
    { path: '/settings', component: SettingsView },
  ],
});

router.beforeEach(async (to) => {
  if (configured.value === null) {
    await checkStatus();
  }
  if (to.meta.requiresConfig && !configured.value) {
    return '/settings';
  }
});

export default router;
