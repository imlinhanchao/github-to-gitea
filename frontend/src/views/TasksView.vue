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
  startPolling,
  stopPolling,
  statusLabel,
  statusBadgeClass,
} from '../composables/useApi';
import type { SyncTask } from '../types';

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
      </div>
    </div>
  </AppLayout>
</template>
