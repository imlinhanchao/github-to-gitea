import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RepositorySyncEntity } from '../../entities/repository-sync.entity';
import { RuntimeConfigService } from '../../config/config.service';
import { GithubService } from '../github/github.service';
import { GiteaService } from '../gitea/gitea.service';

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(RepositorySyncEntity)
    private readonly repositorySyncRepo: Repository<RepositorySyncEntity>,
    private readonly configService: RuntimeConfigService,
    private readonly githubService: GithubService,
    private readonly giteaService: GiteaService,
  ) {}

  private requireConfigured(): void {
    if (!this.configService.isConfigured()) {
      throw new ServiceUnavailableException('App is not configured yet. Please complete setup via the web UI.');
    }
  }

  private normalizeBranches(input: string[], fallback: string): string[] {
    const cleaned = input.map((branch) => branch.trim()).filter(Boolean);
    if (cleaned.length > 0) {
      return Array.from(new Set(cleaned));
    }
    return [fallback || 'main'];
  }

  async addAccount(account: string): Promise<RepositorySyncEntity[]> {
    this.requireConfigured();
    const repos = await this.githubService.listReposForAccount(account);
    const result: RepositorySyncEntity[] = [];
    for (const repo of repos) {
      result.push(await this.upsertAndSync(repo.full_name));
    }
    return result;
  }

  async addRepository(fullName: string): Promise<RepositorySyncEntity> {
    this.requireConfigured();
    return this.upsertAndSync(fullName);
  }

  async updateBranches(id: number, branches: string[]): Promise<RepositorySyncEntity> {
    const target = await this.repositorySyncRepo.findOneByOrFail({ id });
    target.branches = this.normalizeBranches(branches, target.defaultBranch);
    return this.repositorySyncRepo.save(target);
  }

  async syncOne(id: number): Promise<RepositorySyncEntity> {
    this.requireConfigured();
    const target = await this.repositorySyncRepo.findOneByOrFail({ id });
    return this.syncEntity(target);
  }

  async list(): Promise<RepositorySyncEntity[]> {
    return this.repositorySyncRepo.find({ order: { fullName: 'ASC' } });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async syncUpdatedRepositories(): Promise<void> {
    if (!this.configService.isConfigured()) {
      return;
    }
    const all = await this.repositorySyncRepo.find();
    for (const entity of all) {
      const githubRepo = await this.githubService.getRepo(entity.fullName);
      const pushedAt = githubRepo.pushed_at;
      if (!entity.lastGithubPushedAt || new Date(pushedAt) > new Date(entity.lastGithubPushedAt)) {
        await this.syncEntity(entity);
      }
    }
  }

  private async upsertAndSync(fullName: string): Promise<RepositorySyncEntity> {
    let entity = await this.repositorySyncRepo.findOne({ where: { fullName } });
    if (!entity) {
      const info = await this.githubService.getRepo(fullName);
      entity = this.repositorySyncRepo.create({
        fullName,
        owner: info.owner.login,
        repo: info.name,
        isPrivate: info.private,
        defaultBranch: info.default_branch,
        branches: [info.default_branch || 'main'],
        lastGithubPushedAt: info.pushed_at,
        lastSyncedAt: null,
      });
      entity = await this.repositorySyncRepo.save(entity);
    }
    return this.syncEntity(entity);
  }

  private async syncEntity(entity: RepositorySyncEntity): Promise<RepositorySyncEntity> {
    const githubRepo = await this.githubService.getRepo(entity.fullName);
    await this.giteaService.syncRepository(githubRepo, this.normalizeBranches(entity.branches, githubRepo.default_branch));

    entity.owner = githubRepo.owner.login;
    entity.repo = githubRepo.name;
    entity.isPrivate = githubRepo.private;
    entity.defaultBranch = githubRepo.default_branch;
    entity.lastGithubPushedAt = githubRepo.pushed_at;
    entity.lastSyncedAt = new Date().toISOString();

    if (!entity.branches?.length) {
      entity.branches = [githubRepo.default_branch || 'main'];
    }

    return this.repositorySyncRepo.save(entity);
  }
}
