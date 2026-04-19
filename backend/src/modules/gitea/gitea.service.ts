import { Injectable } from '@nestjs/common';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { RuntimeConfigService } from '../../config/config.service';
import { GithubRepository } from '../github/github.service';

@Injectable()
export class GiteaService {
  constructor(private readonly configService: RuntimeConfigService) {}

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

  private async runGit(args: string[], cwd: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const p = spawn('git', args, { cwd, stdio: 'ignore' });
      p.on('exit', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`git ${args.join(' ')} failed with code ${code}`));
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
      const githubUrl = repo.clone_url.replace('https://', `https://oauth2:${config.githubToken}@`);
      const giteaHttp = config.giteaBaseUrl.replace(/\/$/, '').replace('/api/v1', '');
      const giteaUrl = `${giteaHttp}/${repo.owner.login}/${repo.name}.git`.replace('https://', `https://oauth2:${config.giteaToken}@`);

      await this.runGit(['clone', '--bare', githubUrl, repoDir], workspace);
      await this.runGit(['remote', 'add', 'gitea', giteaUrl], repoDir);
      await this.runGit(['fetch', '--all', '--prune'], repoDir);

      for (const branch of branches) {
        await this.runGit(['push', 'gitea', `refs/remotes/origin/${branch}:refs/heads/${branch}`, '--force'], repoDir);
      }
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  }
}
