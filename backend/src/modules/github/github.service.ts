import { Injectable } from '@nestjs/common';
import { RuntimeConfigService } from '../../config/config.service';

const GITHUB_API_VERSION = '2022-11-28';

export interface GithubRepository {
  full_name: string;
  private: boolean;
  default_branch: string;
  pushed_at: string;
  clone_url: string;
  owner: {
    login: string;
  };
  name: string;
}

@Injectable()
export class GithubService {
  constructor(private readonly configService: RuntimeConfigService) {}

  private assertRelativePath(path: string): void {
    if (!path.startsWith('/') || path.includes('://') || path.includes('..')) {
      throw new Error('Invalid GitHub API path');
    }
  }

  private encodeRepoFullName(fullName: string): string {
    const [owner, repo, ...rest] = fullName.split('/');
    if (!owner || !repo || rest.length > 0) {
      throw new Error(`Invalid repository full name: ${fullName}`);
    }
    return `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  }

  private async request<T>(path: string): Promise<T> {
    this.assertRelativePath(path);
    const config = this.configService.loadConfig();
    const response = await fetch(new URL(path, 'https://api.github.com'), {
      headers: {
        Authorization: `Bearer ${config.githubToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.status} ${path}`);
    }

    return response.json() as Promise<T>;
  }

  private async listAllRepos(path: string): Promise<GithubRepository[]> {
    const all: GithubRepository[] = [];
    for (let page = 1; ; page += 1) {
      const batch = await this.request<GithubRepository[]>(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      all.push(...batch);
      if (batch.length < 100) {
        break;
      }
    }
    return all;
  }

  async listReposForAccount(account: string): Promise<GithubRepository[]> {
    const normalizedAccount = account.trim();
    const encodedAccount = encodeURIComponent(normalizedAccount);
    const accessible = await this.listAllRepos('/user/repos?visibility=all&affiliation=owner,collaborator,organization_member');
    const matched = accessible.filter((repo) => repo.owner.login.toLowerCase() === normalizedAccount.toLowerCase());
    if (matched.length > 0) {
      return matched;
    }

    return this.listAllRepos(`/users/${encodedAccount}/repos?type=all`);
  }

  getRepo(fullName: string): Promise<GithubRepository> {
    return this.request<GithubRepository>(`/repos/${this.encodeRepoFullName(fullName)}`);
  }
}
