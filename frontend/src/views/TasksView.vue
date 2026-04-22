<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { Icon } from '@iconify/vue';
import AppLayout from '../layouts/AppLayout.vue';
import {
  apiFetch,
  apiBase,
  tasks,
  sortedTasks,
  hasFailedTasks,
  refreshTasks,
  setTaskPage,
  setTaskPageSize,
  startPolling,
  stopPolling,
  statusLabel,
  statusBadgeClass,
  taskPage,
  taskPageCount,
  taskPageSize,
  taskSummary,
  taskTotal,
} from '../composables/useApi';
import type { SyncTask } from '../types';

const PAGE_SIZES = [20, 50, 100];

async function retryTask(task: SyncTask) {
  await apiFetch(`${apiBase}/tasks/${task.id}/retry`, { method: 'POST' });
  await refreshTasks();
  startPolling();
}

async function cancelTask(task: SyncTask) {
  await apiFetch(`${apiBase}/tasks/${task.id}`, { method: 'DELETE' });
  await refreshTasks();
}

async function clearTasks() {
  await apiFetch(`${apiBase}/tasks`, { method: 'DELETE' });
  await refreshTasks();
}

async function retryAllFailed() {
  await apiFetch(`${apiBase}/tasks/retry-failed`, { method: 'POST' });
  await refreshTasks();
  startPolling();
}

async function syncAll() {
  await apiFetch(`${apiBase}/repositories/run-all`, { method: 'POST' });
  await refreshTasks();
  startPolling();
}

async function goToPreviousPage() {
  if (taskPage.value <= 1) return;
  await setTaskPage(taskPage.value - 1);
}

async function goToNextPage() {
  if (taskPage.value >= taskPageCount.value) return;
  await setTaskPage(taskPage.value + 1);
}

async function changePageSize(value: string) {
  await setTaskPageSize(Number(value));
}

onMounted(async () => {
  await refreshTasks();
  startPolling();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <AppLayout>
    <div class="card bg-base-200 shadow-sm">
      <div class="card-body p-4">
        <!-- Header -->
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 class="card-title">
            <Icon icon="lucide:list-todo" class="w-5 h-5" />
            同步任务队列
          </h2>
          <div class="flex items-center gap-2">
            <div class="tooltip" data-tip="将所有已启用仓库加入同步队列">
              <button class="btn btn-primary btn-sm gap-1" @click="syncAll">
                <Icon icon="lucide:play" class="w-4 h-4" />
                全部同步
              </button>
            </div>
            <div class="tooltip" data-tip="重试所有失败任务">
              <button v-if="hasFailedTasks" class="btn btn-warning btn-sm gap-1" @click="retryAllFailed">
                <Icon icon="lucide:refresh-cw" class="w-4 h-4" />
                重试失败
              </button>
            </div>
            <div class="tooltip" data-tip="清除已完成和失败的任务">
              <button v-if="tasks.length > 0" class="btn btn-sm btn-outline btn-error gap-1" @click="clearTasks">
                <Icon icon="lucide:trash-2" class="w-4 h-4" />
                清除
              </button>
            </div>
            <div class="tooltip" data-tip="刷新">
              <button class="btn btn-ghost btn-sm btn-circle" @click="refreshTasks">
                <Icon icon="lucide:refresh-cw" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <div class="badge badge-outline">总数 {{ taskTotal }}</div>
            <div class="badge badge-info">运行中 {{ taskSummary.running }}</div>
            <div class="badge badge-warning">等待中 {{ taskSummary.pending }}</div>
            <div class="badge badge-success">完成 {{ taskSummary.done }}</div>
            <div class="badge badge-error">失败 {{ taskSummary.failed }}</div>
          </div>
          <label class="flex items-center gap-2 text-sm">
            每页
            <select class="select select-bordered select-xs" :value="taskPageSize" @change="changePageSize(($event.target as HTMLSelectElement).value)">
              <option v-for="size in PAGE_SIZES" :key="size" :value="size">{{ size }}</option>
            </select>
          </label>
        </div>

        <!-- Task list -->
        <div class="space-y-2">
          <div
            v-for="task in sortedTasks"
            :key="task.id"
            class="card bg-base-100 border border-base-300"
          >
            <div class="card-body p-3">
              <div class="flex items-start justify-between gap-2">
                <span class="font-medium text-sm truncate flex-1">{{ task.repoFullName }}</span>
                <div class="flex items-center gap-2 shrink-0">
                  <div class="tooltip" data-tip="取消任务">
                    <button
                      v-if="task.status === 'pending'"
                      class="btn btn-ghost btn-xs btn-circle text-base-content/50"
                      @click="cancelTask(task)"
                    >
                      <Icon icon="lucide:x" class="w-4 h-4" />
                    </button>
                  </div>
                  <div class="tooltip" data-tip="重新同步">
                    <button
                      v-if="task.status === 'failed'"
                      class="btn btn-warning btn-xs gap-1"
                      @click="retryTask(task)"
                    >
                      <Icon icon="lucide:refresh-cw" class="w-3 h-3" />
                      重试
                    </button>
                  </div>
                  <div class="badge text-xs" :class="statusBadgeClass(task.status)">
                    {{ statusLabel(task.status) }}
                  </div>
                </div>
              </div>
              <p v-if="task.error" class="text-xs text-error mt-1 break-all">{{ task.error }}</p>
              <p class="text-xs text-base-content/40 mt-1">
                创建：{{ task.createdAt }}
                <template v-if="task.startedAt"> · 开始：{{ task.startedAt }}</template>
                <template v-if="task.finishedAt"> · 结束：{{ task.finishedAt }}</template>
              </p>
            </div>
          </div>

          <div v-if="tasks.length === 0" class="text-center py-12 text-base-content/40">
            <Icon icon="lucide:check-circle-2" class="w-12 h-12 mx-auto mb-2" />
            <p class="text-sm">暂无任务</p>
          </div>
        </div>

        <div v-if="taskTotal > 0" class="flex flex-wrap items-center justify-between gap-3 mt-4">
          <p class="text-xs text-base-content/50">
            第 {{ taskPage }} / {{ taskPageCount }} 页
          </p>
          <div class="join">
            <button class="btn btn-sm join-item" :disabled="taskPage <= 1" @click="goToPreviousPage">
              上一页
            </button>
            <button class="btn btn-sm join-item pointer-events-none">
              {{ taskPage }}
            </button>
            <button class="btn btn-sm join-item" :disabled="taskPage >= taskPageCount" @click="goToNextPage">
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
