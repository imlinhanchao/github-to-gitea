<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import AppLayout from '../layouts/AppLayout.vue';
import {
  apiFetch,
  apiBase,
  webhookUrl,
  repos,
  tasks,
  queuedRepoNames,
  refresh,
  refreshTasks,
  startPolling,
  stopPolling,
} from '../composables/useApi';
import type { Repo } from '../types';

type RepoFilter = 'all' | 'never' | 'month' | 'year' | 'synced' | 'webhook';

const account = ref('');
const starredAccount = ref('');
const repository = ref('');
const loading = ref(false);
const searchQuery = ref('');
const repoFilter = ref<RepoFilter>('all');

const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;
const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

const filteredRepos = computed(() => {
  const now = Date.now();
  const q = searchQuery.value.toLowerCase().trim();
  return repos.value.filter((r) => {
    if (q && !r.fullName.toLowerCase().includes(q)) return false;
    switch (repoFilter.value) {
      case 'never': return r.lastSyncedAt === null;
      case 'synced': return r.lastSyncedAt !== null;
      case 'month': return r.lastSyncedAt !== null && now - new Date(r.lastSyncedAt).getTime() <= ONE_MONTH;
      case 'year': return r.lastSyncedAt !== null && now - new Date(r.lastSyncedAt).getTime() <= ONE_YEAR;
      case 'webhook': return r.webhookConfigured;
      default: return true;
    }
  });
});

const FILTERS: { key: RepoFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'never', label: '未同步' },
  { key: 'month', label: '一月内' },
  { key: 'year', label: '一年内' },
  { key: 'synced', label: '已同步' },
  { key: 'webhook', label: 'Webhook' },
];

async function addAccount() {
  if (!account.value.trim()) return;
  loading.value = true;
  await apiFetch(`${apiBase}/account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: account.value.trim(), webhookUrl: webhookUrl.value }),
  });
  account.value = '';
  loading.value = false;
  await Promise.all([refresh(), refreshTasks()]);
  startPolling();
}

async function addRepository() {
  if (!repository.value.trim()) return;
  loading.value = true;
  await apiFetch(`${apiBase}/repository`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: repository.value.trim(), webhookUrl: webhookUrl.value }),
  });
  repository.value = '';
  loading.value = false;
  await Promise.all([refresh(), refreshTasks()]);
  startPolling();
}

async function addStarredAccount() {
  if (!starredAccount.value.trim()) return;
  loading.value = true;
  await apiFetch(`${apiBase}/account/starred`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: starredAccount.value.trim(), webhookUrl: webhookUrl.value }),
  });
  starredAccount.value = '';
  loading.value = false;
  await Promise.all([refresh(), refreshTasks()]);
  startPolling();
}

async function updateBranches(repo: Repo, value: string) {
  const branches = value
    .split(',')
    .map((b) => b.trim())
    .filter(Boolean);
  await apiFetch(`${apiBase}/repositories/${repo.id}/branches`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branches }),
  });
  await refresh();
}

async function toggleEnabled(repo: Repo) {
  await apiFetch(`${apiBase}/repositories/${repo.id}/enabled`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: !repo.enabled }),
  });
  await refresh();
}

async function syncNow(repo: Repo) {
  await apiFetch(`${apiBase}/repositories/${repo.id}/run`, { method: 'POST' });
  await refreshTasks();
  startPolling();
}

async function removeFromQueue(repo: Repo) {
  const task = tasks.value.find((t) => t.repoFullName === repo.fullName && t.status === 'pending');
  if (!task) {
    await refreshTasks();
    return;
  }
  await apiFetch(`${apiBase}/tasks/${task.id}`, { method: 'DELETE' });
  await refreshTasks();
}

async function setupWebhook(repo: Repo) {
  const res = await apiFetch(`${apiBase}/repositories/${repo.id}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhookUrl: webhookUrl.value }),
  });
  if (res.ok) {
    await refresh();
  }
}

onMounted(async () => {
  await Promise.all([refresh(), refreshTasks()]);
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <AppLayout>
    <div class="space-y-6">
      <!-- Add account / Add repo -->
      <div class="grid gap-4 md:grid-cols-3">
        <div class="card bg-base-200 shadow-sm">
          <div class="card-body p-4">
            <h2 class="card-title text-base">
              <Icon icon="lucide:user-plus" class="w-5 h-5" />
              添加 GitHub 账号
            </h2>
            <div class="join w-full mt-2">
              <input
                v-model="account"
                class="input input-bordered join-item flex-1 input-sm"
                placeholder="例如 octocat"
                @keyup.enter="addAccount"
              />
              <div class="tooltip" data-tip="导入账号下所有仓库">
                <button
                  class="btn btn-primary join-item btn-sm"
                  :disabled="loading || !account.trim()"
                  @click="addAccount"
                >
                  <Icon icon="lucide:plus" class="w-4 h-4" />
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-200 shadow-sm">
          <div class="card-body p-4">
            <h2 class="card-title text-base">
              <Icon icon="lucide:star" class="w-5 h-5" />
              导入 Star 仓库
            </h2>
            <div class="join w-full mt-2">
              <input
                v-model="starredAccount"
                class="input input-bordered join-item flex-1 input-sm"
                placeholder="例如 octocat"
                @keyup.enter="addStarredAccount"
              />
              <div class="tooltip" data-tip="导入该用户所有 Star 仓库">
                <button
                  class="btn btn-primary join-item btn-sm"
                  :disabled="loading || !starredAccount.trim()"
                  @click="addStarredAccount"
                >
                  <Icon icon="lucide:star" class="w-4 h-4" />
                  导入
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="card bg-base-200 shadow-sm">
          <div class="card-body p-4">
            <h2 class="card-title text-base">
              <Icon icon="lucide:git-fork" class="w-5 h-5" />
              添加单个仓库
            </h2>
            <div class="join w-full mt-2">
              <input
                v-model="repository"
                class="input input-bordered join-item flex-1 input-sm"
                placeholder="例如 owner/repo"
                @keyup.enter="addRepository"
              />
              <div class="tooltip" data-tip="同步到 Gitea">
                <button
                  class="btn btn-primary join-item btn-sm"
                  :disabled="loading || !repository.trim()"
                  @click="addRepository"
                >
                  <Icon icon="lucide:git-pull-request-arrow" class="w-4 h-4" />
                  同步
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Repos list -->
      <div class="card bg-base-200 shadow-sm">
        <div class="card-body p-4">
          <!-- Header: title + search -->
          <div class="flex flex-wrap items-center gap-3 mb-3">
            <h2 class="card-title text-base flex-1">
              <Icon icon="lucide:database" class="w-5 h-5" />
              已配置同步仓库
              <div class="badge badge-neutral badge-sm">{{ filteredRepos.length }}</div>
            </h2>
            <!-- Search -->
            <div class="join">
              <span class="btn btn-ghost join-item btn-sm pointer-events-none">
                <Icon icon="lucide:search" class="w-4 h-4 text-base-content/50" />
              </span>
              <input
                v-model="searchQuery"
                type="text"
                class="input input-bordered join-item input-sm w-44"
                placeholder="搜索仓库名称…"
              />
              <button
                v-if="searchQuery"
                class="btn btn-ghost join-item btn-sm"
                @click="searchQuery = ''"
              >
                <Icon icon="lucide:x" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Filter tabs -->
          <div class="flex flex-wrap gap-1 mb-4">
            <button
              v-for="f in FILTERS"
              :key="f.key"
              class="btn btn-xs"
              :class="repoFilter === f.key ? 'btn-primary' : 'btn-ghost'"
              @click="repoFilter = f.key"
            >{{ f.label }}</button>
          </div>

          <!-- Repo cards -->
          <div class="space-y-2">
            <div
              v-for="repo in filteredRepos"
              :key="repo.id"
              class="card bg-base-100 border border-base-300 transition-opacity"
              :class="{ 'opacity-50': !repo.enabled }"
            >
              <div class="card-body p-3">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-semibold text-sm truncate">{{ repo.fullName }}</span>
                      <div v-if="repo.webhookConfigured" class="tooltip tooltip-right" data-tip="Webhook 已配置">
                        <Icon icon="lucide:webhook" class="w-3.5 h-3.5 text-info" />
                      </div>
                    </div>
                    <p class="text-xs text-base-content/50 mt-0.5">
                      上次同步：{{ repo.lastSyncedAt ?? '未同步' }}
                    </p>
                  </div>

                  <!-- Action buttons -->
                  <div class="flex items-center gap-1 shrink-0">
                    <!-- Queue toggle -->
                    <div
                      class="tooltip tooltip-left"
                      :data-tip="queuedRepoNames.has(repo.fullName) ? '移出同步队列' : '加入同步队列'"
                    >
                      <button
                        class="btn btn-ghost btn-xs btn-circle"
                        :class="queuedRepoNames.has(repo.fullName) ? 'text-warning' : 'text-success'"
                        :disabled="!repo.enabled"
                        @click="queuedRepoNames.has(repo.fullName) ? removeFromQueue(repo) : syncNow(repo)"
                      >
                        <Icon
                          :icon="queuedRepoNames.has(repo.fullName) ? 'lucide:circle-x' : 'lucide:play-circle'"
                          class="w-4 h-4"
                        />
                      </button>
                    </div>

                    <!-- Webhook -->
                    <div
                      class="tooltip tooltip-left"
                      :data-tip="repo.webhookConfigured ? '重新配置 Webhook' : '配置 Webhook'"
                    >
                      <button
                        class="btn btn-ghost btn-xs btn-circle"
                        :class="repo.webhookConfigured ? 'text-info' : 'text-base-content/40'"
                        :disabled="!repo.enabled"
                        @click="setupWebhook(repo)"
                      >
                        <Icon icon="lucide:webhook" class="w-4 h-4" />
                      </button>
                    </div>

                    <!-- Enable / Disable -->
                    <div class="tooltip tooltip-left" :data-tip="repo.enabled ? '停用' : '启用'">
                      <button
                        class="btn btn-ghost btn-xs btn-circle"
                        :class="repo.enabled ? 'text-error' : 'text-base-content/40'"
                        @click="toggleEnabled(repo)"
                      >
                        <Icon :icon="repo.enabled ? 'lucide:pause-circle' : 'lucide:play-circle'" class="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Branches -->
                <label class="text-xs text-base-content/50 mt-1.5 block">分支（逗号分隔）</label>
                <input
                  :value="repo.branches.join(',')"
                  class="input input-bordered input-xs w-full mt-0.5"
                  :disabled="!repo.enabled"
                  @change="updateBranches(repo, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>

            <div v-if="filteredRepos.length === 0" class="text-center py-12 text-base-content/40">
              <Icon icon="lucide:inbox" class="w-12 h-12 mx-auto mb-2" />
              <p class="text-sm">{{ repos.length === 0 ? '暂无仓库，请先添加账号或仓库' : '无匹配仓库' }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
