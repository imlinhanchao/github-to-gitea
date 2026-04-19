<script setup lang="ts">
import { onMounted, ref } from 'vue';

type Repo = {
  id: number;
  fullName: string;
  branches: string[];
  defaultBranch: string;
  lastSyncedAt: string | null;
};

type ConfigView = {
  githubToken: string;
  giteaToken: string;
  giteaBaseUrl: string;
  giteaAdminUsername: string;
  giteaAdminPassword: string;
  dbPath: string;
};

const apiRoot = import.meta.env.VITE_API_BASE ?? 'http://localhost:3001';
const apiBase = `${apiRoot}/sync`;
const configApi = `${apiRoot}/config`;

// --- state ---
const configured = ref<boolean | null>(null); // null = loading
const account = ref('');
const repository = ref('');
const repos = ref<Repo[]>([]);
const loading = ref(false);
const showSettings = ref(false);
const saveError = ref('');

const form = ref<ConfigView>({
  githubToken: '',
  giteaToken: '',
  giteaBaseUrl: 'http://localhost:3000',
  giteaAdminUsername: 'gitea_admin',
  giteaAdminPassword: '',
  dbPath: './data.sqlite',
});

// --- helpers ---
async function checkStatus(): Promise<void> {
  const res = await fetch(`${configApi}/status`);
  const data = await res.json() as { configured: boolean };
  configured.value = data.configured;
  if (data.configured) {
    await refresh();
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
  await refresh();
  loading.value = false;
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
  await refresh();
  loading.value = false;
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
  loading.value = true;
  await fetch(`${apiBase}/repositories/${repo.id}/run`, { method: 'POST' });
  await refresh();
  loading.value = false;
}

onMounted(() => {
  checkStatus();
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
          <label class="block text-sm font-medium text-gray-700">SQLite 数据库路径</label>
          <input v-model="form.dbPath" type="text" class="mt-1 w-full rounded border px-3 py-2" placeholder="./data.sqlite" />
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
    <section class="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div>
        <h1 class="text-xl font-bold">GitHub → Gitea 仓库同步</h1>
        <p class="text-sm text-gray-500">添加账号或仓库后自动同步；支持为每个仓库设置分支列表（默认主分支）。</p>
      </div>
      <button class="rounded border px-3 py-1 text-sm text-gray-600" @click="openSettings">⚙ 配置</button>
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
            <button class="rounded bg-green-600 px-3 py-1 text-white" :disabled="loading" @click="syncNow(repo)">立即同步</button>
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
