<script setup lang="ts">
import { onMounted, ref } from 'vue';

type Repo = {
  id: number;
  fullName: string;
  branches: string[];
  defaultBranch: string;
  lastSyncedAt: string | null;
};

const apiBase = `${import.meta.env.VITE_API_BASE ?? 'http://localhost:3001'}/sync`;
const account = ref('');
const repository = ref('');
const repos = ref<Repo[]>([]);
const loading = ref(false);

async function refresh(): Promise<void> {
  const res = await fetch(`${apiBase}/repositories`);
  repos.value = await res.json();
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
  const branches = value.split(',').map((branch) => branch.trim()).filter(Boolean);
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
  refresh();
});
</script>

<template>
  <main class="mx-auto max-w-4xl p-6 space-y-6">
    <section class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h1 class="text-xl font-bold">GitHub → Gitea 仓库同步</h1>
      <p class="text-sm text-gray-500">添加账号或仓库后自动同步；支持为每个仓库设置分支列表（默认主分支）。</p>
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
