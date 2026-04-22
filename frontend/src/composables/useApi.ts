import { ref, computed } from 'vue';
import type { ActiveTask, AuthStatus, Repo, SyncTask, TaskPage, TaskSummary } from '../types';

const defaultApiRoot = '/api';
const defaultTaskPage = 1;
const defaultTaskPageSize = 50;
const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

export const apiRoot: string = env?.VITE_API_BASE ?? defaultApiRoot;
export const apiBase = `${apiRoot}/sync`;
export const configApi = `${apiRoot}/config`;
export const authApi = `${apiRoot}/auth`;

// Shared singleton state (module-level, not recreated per component)
export const configured = ref<boolean | null>(null);
export const authenticated = ref<boolean | null>(null);
export const authUsername = ref<string | null>(null);
export const repos = ref<Repo[]>([]);
export const tasks = ref<SyncTask[]>([]);
export const activeTasks = ref<ActiveTask[]>([]);
export const taskPage = ref(defaultTaskPage);
export const taskPageSize = ref(defaultTaskPageSize);
export const taskTotal = ref(0);
export const taskPageCount = ref(1);
export const taskSummary = ref<TaskSummary>({
  pending: 0,
  running: 0,
  done: 0,
  failed: 0,
});

export const webhookUrl = computed(() => {
  if (apiRoot.startsWith('http://') || apiRoot.startsWith('https://')) {
    return `${apiRoot}/sync/webhook/github`;
  }
  return new URL(`${apiRoot}/sync/webhook/github`, window.location.href).toString();
});

export const hasActiveTasks = computed(() => taskSummary.value.pending > 0 || taskSummary.value.running > 0);

export const hasFailedTasks = computed(() => taskSummary.value.failed > 0);

export const queuedRepoNames = computed(
  () => new Set(activeTasks.value.map((task) => task.repoFullName)),
);

export const runningRepoNames = computed(
  () => new Set(activeTasks.value.filter((task) => task.status === 'running').map((task) => task.repoFullName)),
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

function applyAuthStatus(status: AuthStatus): void {
  configured.value = status.configured;
  authenticated.value = status.authenticated;
  authUsername.value = status.username;
  if (!status.authenticated) {
    stopPolling();
  }
}

function redirectToLogin(): void {
  if (window.location.hash !== '#/login') {
    window.location.hash = '/login';
  }
}

function applyTaskPage(data: TaskPage): void {
  tasks.value = data.items;
  activeTasks.value = data.activeItems;
  taskPage.value = data.page;
  taskPageSize.value = data.pageSize;
  taskTotal.value = data.total;
  taskPageCount.value = data.pageCount;
  taskSummary.value = data.summary;
}

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    applyAuthStatus({ configured: configured.value ?? true, authenticated: false, username: null });
    redirectToLogin();
  }
  return res;
}

export async function checkStatus(): Promise<void> {
  const res = await fetch(`${authApi}/status`);
  const data = (await res.json()) as AuthStatus;
  applyAuthStatus(data);
  if (data.configured && data.authenticated) {
    await Promise.all([refresh(), refreshTasks()]);
  }
}

export async function login(username: string, password: string): Promise<AuthStatus> {
  const res = await fetch(`${authApi}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    if (res.status === 401) {
      applyAuthStatus({ configured: true, authenticated: false, username: null });
    }
    throw new Error(`Login failed (${res.status})`);
  }
  const data = (await res.json()) as AuthStatus;
  applyAuthStatus(data);
  await Promise.all([refresh(), refreshTasks()]);
  return data;
}

export async function logout(): Promise<void> {
  await fetch(`${authApi}/logout`, { method: 'POST' });
  applyAuthStatus({ configured: configured.value ?? true, authenticated: false, username: null });
}

export async function refresh(): Promise<void> {
  const res = await apiFetch(`${apiBase}/repositories`);
  if (!res.ok) {
    return;
  }
  repos.value = (await res.json()) as Repo[];
}

interface RefreshTaskOptions {
  page?: number;
  pageSize?: number;
}

export async function refreshTasks(options: RefreshTaskOptions = {}): Promise<void> {
  const nextPage = options.page ?? taskPage.value;
  const nextPageSize = options.pageSize ?? taskPageSize.value;
  const params = new URLSearchParams({
    page: String(nextPage),
    pageSize: String(nextPageSize),
  });
  const res = await apiFetch(`${apiBase}/tasks?${params.toString()}`);
  if (res.ok) {
    applyTaskPage((await res.json()) as TaskPage);
  }
}

export async function setTaskPage(page: number): Promise<void> {
  await refreshTasks({ page });
}

export async function setTaskPageSize(pageSize: number): Promise<void> {
  await refreshTasks({ page: defaultTaskPage, pageSize });
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
