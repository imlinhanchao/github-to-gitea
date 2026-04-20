<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';

type Repo = {
  id: number;
  fullName: string;
  branches: string[];
  defaultBranch: string;
  lastSyncedAt: string | null;
  enabled: boolean;
};

type SyncTask = {
  id: number;
  repoFullName: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

type ConfigView = {
  githubToken: string;
  giteaToken: string;
  giteaBaseUrl: string;
  giteaAdminUsername: string;
  giteaAdminPassword: string;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbDatabase: string;
  webhookSecret: string;
};

const apiRoot = import.meta.env.VITE_API_BASE ?? './api';
const apiBase = `${apiRoot}/sync`;
const configApi = `${apiRoot}/config`;

// --- dark mode ---
const isDark = ref(localStorage.getItem('theme') === 'dark');
function applyDark(value: boolean) {
  document.documentElement.classList.toggle('dark', value);
}
function toggleDark() {
  isDark.value = !isDark.value;
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
  applyDark(isDark.value);
}

// --- webhook URL ---
const webhookUrl = computed(() => {
  if (apiRoot.startsWith('http://') || apiRoot.startsWith('https://')) {
    return `${apiRoot}/sync/webhook/github`;
  }
  const path = apiRoot.startsWith('./') ? apiRoot.slice(1) : (apiRoot.startsWith('/') ? apiRoot : `/${apiRoot}`);
  return `${window.location.origin}${path}/sync/webhook/github`;
});

// --- state ---
const configured = ref<boolean | null>(null); // null = loading
const account = ref('');
const repository = ref('');
const repos = ref<Repo[]>([]);
const tasks = ref<SyncTask[]>([]);
const loading = ref(false);
const showSettings = ref(false);
const showTasks = ref(false);
const restartNotice = ref(false);
const saveError = ref('');
const webhookFeedback = ref<Record<number, 'ok' | 'err'>>({});
type RepoFilter = 'all' | 'never' | 'month' | 'year' | 'synced';
const repoFilter = ref<RepoFilter>('all');

let pollTimer: ReturnType<typeof setInterval> | null = null;

const form = ref<ConfigView>({
  githubToken: '',
  giteaToken: '',
  giteaBaseUrl: 'http://localhost:3000',
  giteaAdminUsername: 'gitea_admin',
  giteaAdminPassword: '',
  dbHost: 'localhost',
  dbPort: 3306,
  dbUser: 'root',
  dbPassword: '',
  dbDatabase: 'github_to_gitea',
  webhookSecret: '',
});

const hasActiveTasks = computed(() =>
  tasks.value.some((t) => t.status === 'pending' || t.status === 'running'),
);

const hasFailedTasks = computed(() => tasks.value.some((t) => t.status === 'failed'));

const STATUS_ORDER: Record<SyncTask['status'], number> = { running: 0, failed: 1, pending: 2, done: 3 };

const sortedTasks = computed(() =>
  [...tasks.value].sort((a, b) => {
    const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (diff !== 0) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }),
);

// Set of repo full names that have a pending or running task
const queuedRepoNames = computed(() =>
  new Set(tasks.value.filter((t) => t.status === 'pending' || t.status === 'running').map((t) => t.repoFullName)),
);

const filteredRepos = computed(() => {
  const now = Date.now();
  const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;
  const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
  return repos.value.filter((r) => {
    if (repoFilter.value === 'all') return true;
    if (repoFilter.value === 'never') return r.lastSyncedAt === null;
    if (repoFilter.value === 'synced') return r.lastSyncedAt !== null;
    if (repoFilter.value === 'month') return r.lastSyncedAt !== null && now - new Date(r.lastSyncedAt).getTime() <= ONE_MONTH;
    if (repoFilter.value === 'year') return r.lastSyncedAt !== null && now - new Date(r.lastSyncedAt).getTime() <= ONE_YEAR;
    return true;
  });
});

// --- helpers ---
async function checkStatus(): Promise<void> {
  const res = await fetch(`${configApi}/status`);
  const data = await res.json() as { configured: boolean };
  configured.value = data.configured;
  if (data.configured) {
    await Promise.all([refresh(), refreshTasks()]);
  }
}

async function loadCurrentConfig(): Promise<void> {
  const res = await fetch(configApi);
  if (res.ok) {
    const data = await res.json() as ConfigView | null;
    if (data) {
      form.value = { ...data };
    }
  }
}

async function refresh(): Promise<void> {
  const res = await fetch(`${apiBase}/repositories`);
  repos.value = await res.json() as Repo[];
}

async function refreshTasks(): Promise<void> {
  const res = await fetch(`${apiBase}/tasks?limit=50`);
  if (res.ok) {
    tasks.value = await res.json() as SyncTask[];
  }
}

function startPolling(): void {
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

function stopPolling(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function saveConfig(): Promise<void> {
  saveError.value = '';
  loading.value = true;
  const res = await fetch(configApi, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form.value),
  });
  loading.value = false;
  if (!res.ok) {
    saveError.value = `保存失败 (${res.status})，请检查输入内容。`;
    return;
  }
  configured.value = true;
  showSettings.value = false;
  restartNotice.value = true;
  await refresh();
}

async function openSettings(): Promise<void> {
  await loadCurrentConfig();
  showSettings.value = true;
}

async function addAccount(): Promise<void> {
  if (!account.value.trim()) return;
  loading.value = true;
  await fetch(`${apiBase}/account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: account.value.trim() }),
  });
  account.value = '';
  loading.value = false;
  await Promise.all([refresh(), refreshTasks()]);
  startPolling();
}

async function addRepository(): Promise<void> {
  if (!repository.value.trim()) return;
  loading.value = true;
  await fetch(`${apiBase}/repository`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: repository.value.trim() }),
  });
  repository.value = '';
  loading.value = false;
  await Promise.all([refresh(), refreshTasks()]);
  startPolling();
}

async function updateBranches(repo: Repo, value: string): Promise<void> {
  const branches = value.split(',').map((b) => b.trim()).filter(Boolean);
  await fetch(`${apiBase}/repositories/${repo.id}/branches`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branches }),
  });
  await refresh();
}

async function toggleEnabled(repo: Repo): Promise<void> {
  await fetch(`${apiBase}/repositories/${repo.id}/enabled`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: !repo.enabled }),
  });
  await refresh();
}

async function syncNow(repo: Repo): Promise<void> {
  await fetch(`${apiBase}/repositories/${repo.id}/run`, { method: 'POST' });
  await refreshTasks();
  startPolling();
}

async function removeFromQueue(repo: Repo): Promise<void> {
  // Find the pending task for this repo and cancel it
  const task = tasks.value.find((t) => t.repoFullName === repo.fullName && t.status === 'pending');
  if (task) {
    await fetch(`${apiBase}/tasks/${task.id}`, { method: 'DELETE' });
    await refreshTasks();
  }
}

async function retryTask(task: SyncTask): Promise<void> {
  await fetch(`${apiBase}/tasks/${task.id}/retry`, { method: 'POST' });
  await refreshTasks();
  startPolling();
}

async function cancelTask(task: SyncTask): Promise<void> {
  await fetch(`${apiBase}/tasks/${task.id}`, { method: 'DELETE' });
  await refreshTasks();
}

async function clearTasks(): Promise<void> {
  await fetch(`${apiBase}/tasks`, { method: 'DELETE' });
  await refreshTasks();
}

async function retryAllFailed(): Promise<void> {
  await fetch(`${apiBase}/tasks/retry-failed`, { method: 'POST' });
  await refreshTasks();
  startPolling();
}

async function setupWebhook(repo: Repo): Promise<void> {
  const res = await fetch(`${apiBase}/repositories/${repo.id}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhookUrl: webhookUrl.value }),
  });
  webhookFeedback.value = { ...webhookFeedback.value, [repo.id]: res.ok ? 'ok' : 'err' };
  setTimeout(() => {
    const copy = { ...webhookFeedback.value };
    delete copy[repo.id];
    webhookFeedback.value = copy;
  }, 3000);
}

function statusLabel(status: SyncTask['status']): string {
  return { pending: '等待中', running: '运行中', done: '完成', failed: '失败' }[status];
}

function statusClass(status: SyncTask['status']): string {
  return {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    done: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  }[status];
}

onMounted(() => {
  applyDark(isDark.value);
  checkStatus();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <!-- Loading -->
  <main v-if="configured === null" class="flex items-center justify-center h-screen text-gray-400 dark:bg-gray-900 dark:text-gray-500">
    <span class="i-lucide-loader-circle animate-spin mr-2 text-xl" />正在加载…
  </main>

  <!-- Setup / Settings form -->
  <main v-else-if="!configured || showSettings" class="mx-auto max-w-lg p-6 space-y-6 min-h-screen bg-gray-50 dark:bg-gray-900">
    <section class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm space-y-4">
      <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ configured ? '修改配置' : '初始化配置' }}</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ configured ? '更新 GitHub / Gitea 连接信息。' : '首次使用，请填写以下信息完成初始化。' }}
      </p>

      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">GitHub Token</label>
          <input v-model="form.githubToken" type="password" class="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2" :placeholder="configured ? '已设置，留空则不修改' : ''" autocomplete="off" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Gitea Token</label>
          <input v-model="form.giteaToken" type="password" class="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2" :placeholder="configured ? '已设置，留空则不修改' : ''" autocomplete="off" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Gitea 地址</label>
          <input v-model="form.giteaBaseUrl" type="url" class="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="http://localhost:3000" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Gitea 管理员用户名</label>
          <input v-model="form.giteaAdminUsername" type="text" class="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="gitea_admin" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Gitea 管理员密码</label>
          <input v-model="form.giteaAdminPassword" type="password" class="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2" :placeholder="configured ? '已设置，留空则不修改' : ''" autocomplete="new-password" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">MySQL 主机</label>
          <input v-model="form.dbHost" type="text" class="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="localhost" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">MySQL 端口</label>
          <input v-model.number="form.dbPort" type="number" class="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="3306" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">MySQL 用户名</label>
          <input v-model="form.dbUser" type="text" class="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="root" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">MySQL 密码</label>
          <input v-model="form.dbPassword" type="password" class="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2" :placeholder="configured ? '已设置，留空则不修改' : ''" autocomplete="new-password" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">MySQL 数据库名</label>
          <input v-model="form.dbDatabase" type="text" class="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="github_to_gitea" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">GitHub Webhook 密钥（可选）</label>
          <input v-model="form.webhookSecret" type="password" class="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2" :placeholder="configured ? '已设置，留空则不修改' : '留空则不验证签名'" autocomplete="new-password" />
          <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">Webhook 地址：<code>{{ webhookUrl }}</code></p>
        </div>
      </div>

      <p v-if="saveError" class="text-sm text-red-600 dark:text-red-400">{{ saveError }}</p>

      <div class="flex gap-3 pt-2">
        <button class="flex-1 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50 hover:bg-blue-700" :disabled="loading" @click="saveConfig">
          <span v-if="loading" class="i-lucide-loader-circle animate-spin mr-1" />
          {{ loading ? '保存中…' : '保存配置' }}
        </button>
        <button v-if="configured" class="rounded border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" @click="showSettings = false">取消</button>
      </div>
    </section>
  </main>

  <!-- Main sync UI -->
  <main v-else class="mx-auto max-w-4xl p-6 space-y-6 min-h-screen bg-gray-50 dark:bg-gray-900">
    <section v-if="restartNotice" class="rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 p-4 text-sm text-yellow-800 dark:text-yellow-300 flex items-center justify-between">
      <span>配置已保存。若修改了 MySQL 连接信息，需重启后端服务后生效。</span>
      <button class="ml-4 text-yellow-600 dark:text-yellow-400 hover:underline" @click="restartNotice = false">
        <span class="i-lucide-x" />
      </button>
    </section>

    <section class="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">GitHub → Gitea 仓库同步</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">添加账号或仓库后自动同步；支持为每个仓库设置分支列表（默认主分支）。</p>
      </div>
      <div class="flex gap-2">
        <button class="rounded border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 relative flex items-center gap-1" @click="showTasks = !showTasks">
          <span class="i-lucide-list-todo" />任务
          <span v-if="hasActiveTasks" class="absolute -top-1 -right-1 inline-block w-2 h-2 rounded-full bg-blue-500"></span>
        </button>
        <button class="rounded border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1" @click="openSettings">
          <span class="i-lucide-settings" />配置
        </button>
        <button class="rounded border border-gray-300 dark:border-gray-600 px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1" @click="toggleDark">
          <span :class="isDark ? 'i-lucide-sun' : 'i-lucide-moon'" />
        </button>
      </div>
    </section>

    <!-- Task queue panel -->
    <section v-if="showTasks" class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-semibold text-gray-900 dark:text-gray-100">同步任务队列</h2>
        <div class="flex items-center gap-2">
          <button
            v-if="hasFailedTasks"
            class="text-xs rounded bg-orange-500 px-2 py-1 text-white hover:bg-orange-600 flex items-center gap-1"
            @click="retryAllFailed"
          ><span class="i-lucide-refresh-cw" />重试所有失败</button>
          <button
            v-if="tasks.length > 0"
            class="text-xs rounded bg-red-100 dark:bg-red-900/40 px-2 py-1 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900 flex items-center gap-1"
            @click="clearTasks"
          ><span class="i-lucide-trash-2" />清除已完成</button>
          <button class="text-sm text-gray-500 dark:text-gray-400 hover:underline flex items-center gap-1" @click="refreshTasks">
            <span class="i-lucide-refresh-cw" />刷新
          </button>
        </div>
      </div>
      <div class="space-y-2 max-h-72 overflow-y-auto">
        <div v-for="task in sortedTasks" :key="task.id" class="rounded border border-gray-100 dark:border-gray-700 p-3 text-sm bg-white dark:bg-gray-800">
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium truncate text-gray-900 dark:text-gray-100">{{ task.repoFullName }}</span>
            <div class="flex items-center gap-2 shrink-0">
              <button
                v-if="task.status === 'pending'"
                class="rounded border border-gray-300 dark:border-gray-600 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
                @click="cancelTask(task)"
              ><span class="i-lucide-x" />移除</button>
              <button
                v-if="task.status === 'failed'"
                class="rounded bg-orange-500 px-2 py-0.5 text-xs text-white hover:bg-orange-600 flex items-center gap-1"
                @click="retryTask(task)"
              ><span class="i-lucide-refresh-cw" />重新同步</button>
              <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="statusClass(task.status)">
                {{ statusLabel(task.status) }}
              </span>
            </div>
          </div>
          <p v-if="task.error" class="mt-1 text-xs text-red-600 dark:text-red-400 break-all">{{ task.error }}</p>
          <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
            创建：{{ task.createdAt }}
            <template v-if="task.startedAt"> · 开始：{{ task.startedAt }}</template>
            <template v-if="task.finishedAt"> · 结束：{{ task.finishedAt }}</template>
          </p>
        </div>
        <p v-if="tasks.length === 0" class="text-sm text-gray-500 dark:text-gray-400">暂无任务</p>
      </div>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h2 class="font-semibold text-gray-900 dark:text-gray-100">添加 GitHub 账号</h2>
        <div class="mt-3 flex gap-2">
          <input v-model="account" class="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="例如 octocat" />
          <button class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1" :disabled="loading" @click="addAccount">
            <span class="i-lucide-plus" />添加
          </button>
        </div>
      </div>

      <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h2 class="font-semibold text-gray-900 dark:text-gray-100">添加单个仓库</h2>
        <div class="mt-3 flex gap-2">
          <input v-model="repository" class="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2" placeholder="例如 owner/repo" />
          <button class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1" :disabled="loading" @click="addRepository">
            <span class="i-lucide-git-branch" />同步
          </button>
        </div>
      </div>
    </section>

    <section class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 class="font-semibold text-gray-900 dark:text-gray-100">已配置同步仓库</h2>
        <div class="flex flex-wrap gap-1 text-xs">
          <button
            v-for="(label, key) in { all: '全部', never: '未同步', month: '一个月内', year: '一年内', synced: '已同步' }"
            :key="key"
            class="rounded-full px-3 py-1 border"
            :class="repoFilter === key ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'"
            @click="repoFilter = key as RepoFilter"
          >{{ label }}</button>
        </div>
      </div>
      <div class="mt-1 space-y-3">
        <div
          v-for="repo in filteredRepos"
          :key="repo.id"
          class="rounded border p-3"
          :class="repo.enabled ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60'"
        >
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p class="font-medium text-gray-900 dark:text-gray-100">{{ repo.fullName }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">上次同步：{{ repo.lastSyncedAt ?? '未同步' }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0 flex-wrap">
              <!-- Sync / Remove from queue button -->
              <button
                v-if="!queuedRepoNames.has(repo.fullName)"
                class="rounded px-3 py-1 text-sm flex items-center gap-1"
                :class="repo.enabled ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'"
                :disabled="!repo.enabled"
                @click="syncNow(repo)"
              ><span class="i-lucide-play" />加入同步队列</button>
              <button
                v-else
                class="rounded px-3 py-1 text-sm flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900 border border-yellow-300 dark:border-yellow-700"
                @click="removeFromQueue(repo)"
              ><span class="i-lucide-x" />移出同步队列</button>
              <!-- Webhook button -->
              <button
                class="rounded px-3 py-1 text-sm flex items-center gap-1 border"
                :class="webhookFeedback[repo.id] === 'ok' ? 'border-green-400 text-green-600 dark:text-green-400' : webhookFeedback[repo.id] === 'err' ? 'border-red-400 text-red-600 dark:text-red-400' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
                :disabled="!repo.enabled"
                @click="setupWebhook(repo)"
              >
                <span :class="webhookFeedback[repo.id] === 'ok' ? 'i-lucide-check' : webhookFeedback[repo.id] === 'err' ? 'i-lucide-alert-circle' : 'i-lucide-webhook'" />
                {{ webhookFeedback[repo.id] === 'ok' ? '已配置' : webhookFeedback[repo.id] === 'err' ? '配置失败' : '配置 Webhook' }}
              </button>
              <!-- Enable / Disable button -->
              <button
                class="rounded px-3 py-1 text-sm border flex items-center gap-1"
                :class="repo.enabled ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30' : 'border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'"
                @click="toggleEnabled(repo)"
              >
                <span :class="repo.enabled ? 'i-lucide-pause-circle' : 'i-lucide-play-circle'" />
                {{ repo.enabled ? '停用' : '启用' }}
              </button>
            </div>
          </div>
          <label class="mt-2 block text-xs text-gray-600 dark:text-gray-400">分支（逗号分隔）</label>
          <input
            :value="repo.branches.join(',')"
            class="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm disabled:opacity-50"
            :disabled="!repo.enabled"
            @change="updateBranches(repo, ($event.target as HTMLInputElement).value)"
          />
        </div>
        <p v-if="filteredRepos.length === 0" class="text-sm text-gray-500 dark:text-gray-400">{{ repos.length === 0 ? '暂无仓库' : '无匹配仓库' }}</p>
      </div>
    </section>
  </main>
</template>

