<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import AppLayout from '../layouts/AppLayout.vue';
import { configApi, configured, webhookUrl, refresh } from '../composables/useApi';
import type { ConfigView } from '../types';

const router = useRouter();
const loading = ref(false);
const saveError = ref('');
const restartNotice = ref(false);

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

async function loadCurrentConfig() {
  const res = await fetch(configApi);
  if (res.ok) {
    const data = (await res.json()) as ConfigView | null;
    if (data) form.value = { ...data };
  }
}

async function saveConfig() {
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
  const wasConfigured = configured.value;
  configured.value = true;
  restartNotice.value = true;
  if (wasConfigured) {
    await refresh();
  }
  router.push('/');
}

onMounted(async () => {
  if (configured.value) {
    await loadCurrentConfig();
  }
});
</script>

<template>
  <AppLayout>
    <div class="max-w-lg mx-auto">
      <div class="card bg-base-200 shadow-sm">
        <div class="card-body p-6 space-y-4">
          <h1 class="card-title text-xl">
            <Icon icon="lucide:settings" class="w-6 h-6" />
            {{ configured ? '修改配置' : '初始化配置' }}
          </h1>
          <p class="text-sm text-base-content/60">
            {{ configured ? '更新 GitHub / Gitea 连接信息。' : '首次使用，请填写以下信息完成初始化。' }}
          </p>

          <div v-if="restartNotice" class="alert alert-warning text-sm py-2">
            <Icon icon="lucide:alert-triangle" class="w-4 h-4" />
            <span>配置已保存。若修改了 MySQL 连接信息，需重启后端服务后生效。</span>
          </div>

          <div class="space-y-3">
            <div class="form-control">
              <label class="label"><span class="label-text font-medium">GitHub Token</span></label>
              <input
                v-model="form.githubToken"
                type="password"
                class="input input-bordered input-sm"
                :placeholder="configured ? '已设置，留空则不修改' : ''"
                autocomplete="off"
              />
            </div>

            <div class="form-control">
              <label class="label"><span class="label-text font-medium">Gitea Token</span></label>
              <input
                v-model="form.giteaToken"
                type="password"
                class="input input-bordered input-sm"
                :placeholder="configured ? '已设置，留空则不修改' : ''"
                autocomplete="off"
              />
            </div>

            <div class="form-control">
              <label class="label"><span class="label-text font-medium">Gitea 地址</span></label>
              <input
                v-model="form.giteaBaseUrl"
                type="url"
                class="input input-bordered input-sm"
                placeholder="http://localhost:3000"
              />
            </div>

            <div class="form-control">
              <label class="label"><span class="label-text font-medium">Gitea 管理员用户名</span></label>
              <input
                v-model="form.giteaAdminUsername"
                type="text"
                class="input input-bordered input-sm"
                placeholder="gitea_admin"
              />
            </div>

            <div class="form-control">
              <label class="label"><span class="label-text font-medium">Gitea 管理员密码</span></label>
              <input
                v-model="form.giteaAdminPassword"
                type="password"
                class="input input-bordered input-sm"
                :placeholder="configured ? '已设置，留空则不修改' : ''"
                autocomplete="new-password"
              />
            </div>

            <div class="divider text-sm opacity-60">数据库配置</div>

            <div class="grid grid-cols-2 gap-3">
              <div class="form-control">
                <label class="label"><span class="label-text font-medium">MySQL 主机</span></label>
                <input
                  v-model="form.dbHost"
                  type="text"
                  class="input input-bordered input-sm"
                  placeholder="localhost"
                />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text font-medium">MySQL 端口</span></label>
                <input
                  v-model.number="form.dbPort"
                  type="number"
                  class="input input-bordered input-sm"
                  placeholder="3306"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="form-control">
                <label class="label"><span class="label-text font-medium">MySQL 用户名</span></label>
                <input
                  v-model="form.dbUser"
                  type="text"
                  class="input input-bordered input-sm"
                  placeholder="root"
                />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text font-medium">MySQL 密码</span></label>
                <input
                  v-model="form.dbPassword"
                  type="password"
                  class="input input-bordered input-sm"
                  :placeholder="configured ? '已设置，留空则不修改' : ''"
                  autocomplete="new-password"
                />
              </div>
            </div>

            <div class="form-control">
              <label class="label"><span class="label-text font-medium">MySQL 数据库名</span></label>
              <input
                v-model="form.dbDatabase"
                type="text"
                class="input input-bordered input-sm"
                placeholder="github_to_gitea"
              />
            </div>

            <div class="divider text-sm opacity-60">Webhook 配置</div>

            <div class="form-control">
              <label class="label">
                <span class="label-text font-medium">GitHub Webhook 密钥（可选）</span>
              </label>
              <input
                v-model="form.webhookSecret"
                type="password"
                class="input input-bordered input-sm"
                :placeholder="configured ? '已设置，留空则不修改' : '留空则不验证签名'"
                autocomplete="new-password"
              />
              <label class="label">
                <span class="label-text-alt text-base-content/50 break-all">
                  Webhook 地址：<code class="text-xs bg-base-300 px-1 rounded">{{ webhookUrl }}</code>
                </span>
              </label>
            </div>
          </div>

          <div v-if="saveError" class="alert alert-error text-sm py-2">
            <Icon icon="lucide:alert-circle" class="w-4 h-4" />
            {{ saveError }}
          </div>

          <div class="card-actions pt-2 gap-2">
            <button
              class="btn btn-primary flex-1"
              :class="{ loading: loading }"
              :disabled="loading"
              @click="saveConfig"
            >
              <Icon v-if="!loading" icon="lucide:save" class="w-4 h-4" />
              {{ loading ? '保存中…' : '保存配置' }}
            </button>
            <button v-if="configured" class="btn btn-ghost" @click="router.back()">取消</button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
