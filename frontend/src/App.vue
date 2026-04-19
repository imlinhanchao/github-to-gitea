<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';

type Repo = {
  id: number;
  fullName: string;
  branches: string[];
  defaultBranch: string;
  lastSyncedAt: string | null;
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
};

const apiRoot = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';
const apiBase = `${apiRoot}/sync`;
const configApi = `${apiRoot}/config`;

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
});

const hasActiveTasks = computed(() =>
  tasks.value.some((t) => t.status === 'pending' || t.status === 'running'),
);

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
    // Also refresh repo list to pick up updated lastSyncedAt
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

async function syncNow(repo: Repo): Promise<void> {
  await fetch(`${apiBase}/repositories/${repo.id}/run`, { method: 'POST' });
  await refreshTasks();
  startPolling();
}

function statusLabel(status: SyncTask['status']): string {
  return { pending: '等待中', running: '运行中', done: '完成', failed: '失败' }[status];
}

function statusClass(status: SyncTask['status']): string {
  return {
    pending: 'bg-yellow-100 text-yellow-800',
    running: 'bg-blue-100 text-blue-800',
    done: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }[status];
}

onMounted(() => {
  checkStatus();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <!-- Loading -->
  <main v-if="configured === null" class="flex items-center justify-center h-screen text-gray-400">
    正在加载…
  </main>

  <!-- Setup / Settings form -->
  <main v-else-if="!configured || showSettings" class="mx-auto max-w-lg p-6 space-y-6">
    <section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
      <h1 class="text-xl font-bold">{{ configured ? '修改配置' : '初始化配置' }}</h1>
      <p class="text-sm text-gray-500">
        {{ configured ? '更新 GitHub / Gitea 连接信息。' : '首次使用，请填写以下信息完成初始化。' }}
      </p>

      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700">GitHub Token</label>
          <input v-model="form.githubToken" type="password" class="mt-1 w-full rounded border px-3 py-2" :placeholder="configured ? '已设置，留空则不修改' : ''" autocomplete="off" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Gitea Token</label>
          <input v-model="form.giteaToken" type="password" class="mt-1 w-full rounded border px-3 py-2" :placeholder="configured ? '已设置，留空则不修改' : ''" autocomplete="off" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Gitea 地址</label>
          <input v-model="form.giteaBaseUrl" type="url" class="mt-1 w-full rounded border px-3 py-2" placeholder="http://localhost:3000" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Gitea 管理员用户名</label>
          <input v-model="form.giteaAdminUsername" type="text" class="mt-1 w-full rounded border px-3 py-2" placeholder="gitea_admin" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Gitea 管理员密码</label>
          <input v-model="form.giteaAdminPassword" type="password" class="mt-1 w-full rounded border px-3 py-2" :placeholder="configured ? '已设置，留空则不修改' : ''" autocomplete="new-password" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">MySQL 主机</label>
          <input v-model="form.dbHost" type="text" class="mt-1 w-full rounded border px-3 py-2" placeholder="localhost" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">MySQL 端口</label>
          <input v-model.number="form.dbPort" type="number" class="mt-1 w-full rounded border px-3 py-2" placeholder="3306" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">MySQL 用户名</label>
          <input v-model="form.dbUser" type="text" class="mt-1 w-full rounded border px-3 py-2" placeholder="root" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">MySQL 密码</label>
          <input v-model="form.dbPassword" type="password" class="mt-1 w-full rounded border px-3 py-2" :placeholder="configured ? '已设置，留空则不修改' : ''" autocomplete="new-password" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">MySQL 数据库名</label>
          <input v-model="form.dbDatabase" type="text" class="mt-1 w-full rounded border px-3 py-2" placeholder="github_to_gitea" />
        </div>
      </div>

      <p v-if="saveError" class="text-sm text-red-600">{{ saveError }}</p>

      <div class="flex gap-3 pt-2">
        <button class="flex-1 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50" :disabled="loading" @click="saveConfig">
          {{ loading ? '保存中…' : '保存配置' }}
        </button>
        <button v-if="configured" class="rounded border px-4 py-2 text-gray-600" @click="showSettings = false">取消</button>
      </div>
    </section>
  </main>

  <!-- Main sync UI -->
  <main v-else class="mx-auto max-w-4xl p-6 space-y-6">
    <section v-if="restartNotice" class="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 flex items-center justify-between">
      <span>配置已保存。若修改了 MySQL 连接信息，需重启后端服务后生效。</span>
      <button class="ml-4 text-yellow-600 hover:underline" @click="restartNotice = false">✕</button>
    </section>

    <section class="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div>
        <h1 class="text-xl font-bold">GitHub → Gitea 仓库同步</h1>
        <p class="text-sm text-gray-500">添加账号或仓库后自动同步；支持为每个仓库设置分支列表（默认主分支）。</p>
      </div>
      <div class="flex gap-2">
        <button class="rounded border px-3 py-1 text-sm text-gray-600 relative" @click="showTasks = !showTasks">
          📋 任务
          <span v-if="hasActiveTasks" class="absolute -top-1 -right-1 inline-block w-2 h-2 rounded-full bg-blue-500"></span>
        </button>
        <button class="rounded border px-3 py-1 text-sm text-gray-600" @click="openSettings">⚙ 配置</button>
      </div>
    </section>

    <!-- Task queue panel -->
    <section v-if="showTasks" class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-semibold">同步任务队列</h2>
        <button class="text-sm text-gray-500 hover:underline" @click="refreshTasks">刷新</button>
      </div>
      <div class="space-y-2 max-h-72 overflow-y-auto">
        <div v-for="task in tasks" :key="task.id" class="rounded border border-gray-100 p-3 text-sm">
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium truncate">{{ task.repoFullName }}</span>
            <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" :class="statusClass(task.status)">
              {{ statusLabel(task.status) }}
            </span>
          </div>
          <p v-if="task.error" class="mt-1 text-xs text-red-600 break-all">{{ task.error }}</p>
          <p class="mt-1 text-xs text-gray-400">
            创建：{{ task.createdAt }}
            <template v-if="task.startedAt"> · 开始：{{ task.startedAt }}</template>
            <template v-if="task.finishedAt"> · 结束：{{ task.finishedAt }}</template>
          </p>
        </div>
        <p v-if="tasks.length === 0" class="text-sm text-gray-500">暂无任务</p>
      </div>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
      <div class="rounded-lg border p-4">
        <h2 class="font-semibold">添加 GitHub 账号</h2>
        <div class="mt-3 flex gap-2">
          <input v-model="account" class="flex-1 rounded border px-3 py-2" placeholder="例如 octocat" />
          <button class="rounded bg-blue-600 px-4 py-2 text-white" :disabled="loading" @click="addAccount">添加</button>
        </div>
      </div>

      <div class="rounded-lg border p-4">
        <h2 class="font-semibold">添加单个仓库</h2>
        <div class="mt-3 flex gap-2">
          <input v-model="repository" class="flex-1 rounded border px-3 py-2" placeholder="例如 owner/repo" />
          <button class="rounded bg-blue-600 px-4 py-2 text-white" :disabled="loading" @click="addRepository">同步</button>
        </div>
      </div>
    </section>

    <section class="rounded-lg border p-4">
      <h2 class="font-semibold">已配置同步仓库</h2>
      <div class="mt-3 space-y-3">
        <div v-for="repo in repos" :key="repo.id" class="rounded border border-gray-200 p-3">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-medium">{{ repo.fullName }}</p>
              <p class="text-xs text-gray-500">上次同步：{{ repo.lastSyncedAt ?? '未同步' }}</p>
            </div>
            <button class="rounded bg-green-600 px-3 py-1 text-white" @click="syncNow(repo)">立即同步</button>
          </div>
          <label class="mt-2 block text-xs text-gray-600">分支（逗号分隔）</label>
          <input
            :value="repo.branches.join(',')"
            class="mt-1 w-full rounded border px-3 py-2"
            @change="updateBranches(repo, ($event.target as HTMLInputElement).value)"
          />
        </div>
        <p v-if="repos.length === 0" class="text-sm text-gray-500">暂无仓库</p>
      </div>
    </section>
  </main>
</template>
