import { existsSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { resolve } from 'node:path';
import { AppConfig, defaultConfigPath } from './app-config';

async function ask(question: string, fallback?: string): Promise<string> {
  const rl = createInterface({ input, output });
  const answer = (await rl.question(fallback ? `${question} (${fallback}): ` : `${question}: `)).trim();
  rl.close();
  return answer || fallback || '';
}

export async function ensureConfigFile(configPath = defaultConfigPath): Promise<void> {
  const fullPath = resolve(process.cwd(), configPath);
  if (existsSync(fullPath)) {
    return;
  }
  if (!process.stdin.isTTY) {
    throw new Error('config.json is missing and interactive prompt is unavailable in non-TTY mode.');
  }

  const config: AppConfig = {
    githubToken: await ask('请输入 GitHub token'),
    giteaToken: await ask('请输入 Gitea admin token'),
    giteaBaseUrl: await ask('请输入 Gitea 地址', 'http://localhost:3000'),
    giteaAdminUsername: await ask('请输入 Gitea 管理员用户名', 'gitea_admin'),
    giteaAdminPassword: await ask('请输入 Gitea 管理员密码'),
    dbPath: await ask('请输入数据库 sqlite 文件路径', './data.sqlite')
  };

  writeFileSync(fullPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
}
