import { Injectable } from '@nestjs/common';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { RuntimeConfigService } from '../../config/config.service';
import { GithubRepository } from '../github/github.service';

@Injectable()
export class GiteaService {
  constructor(private readonly configService: RuntimeConfigService) {}

  private encodeRepoHttpsPath(fullName: string): string {
    const [owner, repo, ...rest] = fullName.split('/');
    if (!owner || !repo || rest.length > 0) {
      throw new Error(`Invalid repository full name: ${fullName}`);
    }
    return `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}.git`;
  }

  private getGiteaGitBaseUrl(baseUrl: string): string {
    const url = new URL(baseUrl);
    url.pathname = url.pathname.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  }

  private createAskPassScript(workspace: string, fileName: string): string {
    const scriptPath = join(workspace, fileName);
    const script = `#!/bin/sh
case "$1" in
  *Username*) printf "%s" "oauth2" ;;
  *) printf "%s" "$GIT_SYNC_TOKEN" ;;
esac
`;
    writeFileSync(scriptPath, script, { encoding: 'utf-8' });
    chmodSync(scriptPath, 0o700);
    return scriptPath;
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const config = this.configService.loadConfig();
    const response = await fetch(`${config.giteaBaseUrl}/api/v1${path}`, {
      ...init,
      headers: {
        Authorization: `token ${config.giteaToken}`,
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      }
    });
    return response;
  }

  private async runGit(args: string[], cwd: string, env?: NodeJS.ProcessEnv): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let stderr = '';
      const p = spawn('git', args, {
        cwd,
        stdio: ['ignore', 'ignore', 'pipe'],
        env: { ...process.env, ...(env || {}) },
        windowsHide: true,
      });
      p.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      p.on('exit', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`git ${args.join(' ')} failed with code ${code}: ${stderr.trim()}`));
      });
      p.on('error', reject);
    });
  }

  private async ensureUser(owner: string): Promise<void> {
    const config = this.configService.loadConfig();
    const user = await this.request(`/users/${owner}`);
    if (user.ok) {
      return;
    }

    const create = await this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email: `${owner}@local.gitea`,
        username: owner,
        login_name: owner,
        password: config.giteaAdminPassword,
        must_change_password: false,
        restricted: false,
        send_notify: false,
        source_id: 0,
        visibility: 'public'
      })
    });

    if (!create.ok && create.status !== 422) {
      throw new Error(`failed to create gitea user ${owner}: ${create.status}`);
    }
  }

  async ensureUserExists(username: string): Promise<void> {
    const normalized = username.trim();
    if (!normalized) {
      throw new Error('gitea username is required');
    }
    await this.ensureUser(normalized);
  }

  private async ensureRepo(owner: string, repo: string, isPrivate: boolean): Promise<void> {
    const existing = await this.request(`/repos/${owner}/${repo}`);
    if (existing.ok) {
      return;
    }

    const create = await this.request(`/admin/users/${owner}/repos`, {
      method: 'POST',
      body: JSON.stringify({
        name: repo,
        private: isPrivate,
        auto_init: false
      })
    });

    if (!create.ok && create.status !== 409) {
      throw new Error(`failed to create gitea repo ${owner}/${repo}: ${create.status}`);
    }
  }

  async syncRepository(repo: GithubRepository, branches: string[]): Promise<void> {
    const config = this.configService.loadConfig();
    await this.ensureUser(repo.owner.login);
    await this.ensureRepo(repo.owner.login, repo.name, repo.private);

    const workspace = mkdtempSync(join(tmpdir(), 'github-to-gitea-'));
    try {
      const repoDir = join(workspace, 'repo.git');
      const githubUrl = repo.clone_url;
      const giteaHttp = this.getGiteaGitBaseUrl(config.giteaBaseUrl);
      const giteaUrl = `${giteaHttp}/${this.encodeRepoHttpsPath(`${repo.owner.login}/${repo.name}`)}`;
      const githubAskPass = this.createAskPassScript(workspace, 'github-askpass.sh');
      const giteaAskPass = this.createAskPassScript(workspace, 'gitea-askpass.sh');

      await this.runGit(['clone', '--bare', githubUrl, repoDir], workspace, {
        GIT_ASKPASS: githubAskPass,
        GIT_TERMINAL_PROMPT: '0',
        GIT_SYNC_TOKEN: config.githubToken,
      });
      await this.runGit(['remote', 'add', 'gitea', giteaUrl], repoDir);

      for (const branch of branches) {
        await this.runGit(['push', 'gitea', `refs/heads/${branch}:refs/heads/${branch}`, '--force'], repoDir, {
          GIT_ASKPASS: giteaAskPass,
          GIT_TERMINAL_PROMPT: '0',
          GIT_SYNC_TOKEN: config.giteaToken,
        });
      }
    } finally {
      try {
        rmSync(workspace, { recursive: true, force: true });
      } catch {}
    }
  }

  async starRepositoryForUser(username: string, owner: string, repo: string): Promise<void> {
    const normalizedUser = username.trim();
    if (!normalizedUser) {
      throw new Error('gitea username is required');
    }
    const response = await this.request(`/user/starred/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      method: 'PUT',
      headers: {
        Sudo: normalizedUser,
      },
    });
    if (!response.ok) {
      throw new Error(`failed to star gitea repo ${owner}/${repo} as ${normalizedUser}: ${response.status}`);
    }
  }
}
