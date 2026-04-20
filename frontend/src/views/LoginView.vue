<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { login } from '../composables/useApi';

const route = useRoute();
const router = useRouter();

const username = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');

async function submit(): Promise<void> {
  if (!username.value.trim() || !password.value) {
    errorMessage.value = '请输入管理员账号和密码。';
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  try {
    await login(username.value.trim(), password.value);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.replace(redirect);
  } catch {
    errorMessage.value = '登录失败，请检查 Gitea 管理员账号或密码。';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-100 flex items-center justify-center px-4">
    <div class="card w-full max-w-md bg-base-200 shadow-xl">
      <div class="card-body p-6 space-y-4">
        <div class="space-y-2 text-center">
          <div class="inline-flex mx-auto items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary">
            <Icon icon="lucide:shield-check" class="w-6 h-6" />
          </div>
          <h1 class="text-2xl font-semibold">管理员登录</h1>
          <p class="text-sm text-base-content/60">配置完成后，需要使用 Gitea 管理员账号访问系统。</p>
        </div>

        <div class="space-y-3">
          <div class="form-control">
            <label class="label"><span class="label-text font-medium">管理员账号</span></label>
            <input
              v-model="username"
              type="text"
              class="input input-bordered"
              autocomplete="username"
              @keyup.enter="submit"
            />
          </div>

          <div class="form-control">
            <label class="label"><span class="label-text font-medium">管理员密码</span></label>
            <input
              v-model="password"
              type="password"
              class="input input-bordered"
              autocomplete="current-password"
              @keyup.enter="submit"
            />
          </div>
        </div>

        <div v-if="errorMessage" class="alert alert-error text-sm py-2">
          <Icon icon="lucide:alert-circle" class="w-4 h-4" />
          <span>{{ errorMessage }}</span>
        </div>

        <button class="btn btn-primary w-full" :class="{ loading: loading }" :disabled="loading" @click="submit">
          <Icon v-if="!loading" icon="lucide:log-in" class="w-4 h-4" />
          {{ loading ? '登录中…' : '登录' }}
        </button>
      </div>
    </div>
  </div>
</template>