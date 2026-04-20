import { ref, computed } from 'vue';
import type { Repo, SyncTask } from '../types';

export const apiRoot: string = (import.meta.env.VITE_API_BASE as string | undefined) ?? './api';
export const apiBase = `${apiRoot}/sync`;
export const configApi = `${apiRoot}/config`;

// Shared singleton state (module-level, not recreated per component)
export const configured = ref<boolean | null>(null);
export const repos = ref<Repo[]>([]);
export const tasks = ref<SyncTask[]>([]);

export const webhookUrl = computed(() => {
  if (apiRoot.startsWith('http://') || apiRoot.startsWith('https://')) {
    return `${apiRoot}/sync/webhook/github`;
  }
  const path = apiRoot.startsWith('./') ? apiRoot.slice(1) : apiRoot.startsWith('/') ? apiRoot : `/${apiRoot}`;
  return `${window.location.origin}${path}/sync/webhook/github`;
});

export const hasActiveTasks = computed(() =>
  tasks.value.some((t) => t.status === 'pending' || t.status === 'running'),
);

export const hasFailedTasks = computed(() => tasks.value.some((t) => t.status === 'failed'));

export const queuedRepoNames = computed(
  () => new Set(tasks.value.filter((t) => t.status === 'pending' || t.status === 'running').map((t) => t.repoFullName)),
);

const STATUS_ORDER: Record<SyncTask['status'], number> = { running: 0, failed: 1, pending: 2, done: 3 };

export const sortedTasks = computed(() =>
  [...tasks.value].sort((a, b) => {
    const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (diff !== 0) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }),
);

let pollTimer: ReturnType<typeof setInterval> | null = null;

export async function checkStatus(): Promise<void> {
  const res = await fetch(`${configApi}/status`);
  const data = (await res.json()) as { configured: boolean };
  configured.value = data.configured;
  if (data.configured) {
    await Promise.all([refresh(), refreshTasks()]);
  }
}

export async function refresh(): Promise<void> {
  const res = await fetch(`${apiBase}/repositories`);
  repos.value = (await res.json()) as Repo[];
}

export async function refreshTasks(): Promise<void> {
  const res = await fetch(`${apiBase}/tasks?limit=50`);
  if (res.ok) {
    tasks.value = (await res.json()) as SyncTask[];
  }
}

export function startPolling(): void {
  if (pollTimer !== null) return;
  pollTimer = setInterval(async () => {
    await refreshTasks();
    if (hasActiveTasks.value) {
      await refresh();
    }
    if (!hasActiveTasks.value) {
      stopPolling();
      await refresh();
    }
  }, 2000);
}

export function stopPolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function statusLabel(status: SyncTask['status']): string {
  return { pending: '等待中', running: '运行中', done: '完成', failed: '失败' }[status];
}

export function statusBadgeClass(status: SyncTask['status']): string {
  return { pending: 'badge-warning', running: 'badge-info', done: 'badge-success', failed: 'badge-error' }[status];
}
