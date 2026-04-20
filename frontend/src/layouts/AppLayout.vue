<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { Icon } from '@iconify/vue';
import { hasActiveTasks } from '../composables/useApi';

const currentTheme = ref(localStorage.getItem('theme') ?? 'cmyk');

function applyTheme(theme: string) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  currentTheme.value = theme;
}

function toggleTheme() {
  applyTheme(currentTheme.value === 'halloween' ? 'cmyk' : 'halloween');
}

onMounted(() => {
  applyTheme(currentTheme.value);
});
</script>

<template>
  <div class="min-h-screen bg-base-100">
    <div class="navbar bg-base-200 shadow sticky top-0 z-50 px-4">
      <div class="navbar-start">
        <RouterLink to="/" class="btn btn-ghost text-base font-bold gap-1 px-2">
          <Icon icon="lucide:git-merge" class="w-5 h-5 text-primary" />
          <span class="hidden sm:inline">GitHub → Gitea</span>
        </RouterLink>
      </div>

      <div class="navbar-center">
        <ul class="menu menu-horizontal gap-1 px-1">
          <li>
            <RouterLink to="/" class="btn btn-ghost btn-sm gap-1" active-class="btn-active">
              <Icon icon="lucide:database" class="w-4 h-4" />
              <span class="hidden sm:inline">仓库</span>
            </RouterLink>
          </li>
          <li class="relative">
            <RouterLink to="/tasks" class="btn btn-ghost btn-sm gap-1" active-class="btn-active">
              <Icon icon="lucide:list-todo" class="w-4 h-4" />
              <span class="hidden sm:inline">任务</span>
            </RouterLink>
            <span v-if="hasActiveTasks" class="badge badge-primary badge-xs absolute -top-1 right-0 pointer-events-none"></span>
          </li>
        </ul>
      </div>

      <div class="navbar-end gap-1">
        <div class="tooltip tooltip-bottom" data-tip="设置">
          <RouterLink to="/settings">
            <button class="btn btn-ghost btn-sm btn-circle">
              <Icon icon="lucide:settings" class="w-5 h-5" />
            </button>
          </RouterLink>
        </div>
        <div class="tooltip tooltip-bottom" :data-tip="currentTheme === 'halloween' ? '切换亮色' : '切换万圣节主题'">
          <button class="btn btn-ghost btn-sm btn-circle" @click="toggleTheme">
            <Icon :icon="currentTheme === 'halloween' ? 'lucide:sun' : 'lucide:moon'" class="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>

    <main class="container mx-auto px-4 py-6 max-w-5xl">
      <slot />
    </main>
  </div>
</template>
