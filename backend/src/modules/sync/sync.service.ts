import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RepositorySyncEntity } from '../../entities/repository-sync.entity';
import { SyncTaskEntity } from '../../entities/sync-task.entity';
import { RuntimeConfigService } from '../../config/config.service';
import { GithubService } from '../github/github.service';
import { GiteaService } from '../gitea/gitea.service';
import { SyncQueueService } from './sync-queue.service';

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(RepositorySyncEntity)
    private readonly repositorySyncRepo: Repository<RepositorySyncEntity>,
    private readonly configService: RuntimeConfigService,
    private readonly githubService: GithubService,
    private readonly giteaService: GiteaService,
    private readonly syncQueueService: SyncQueueService,
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

  async addAccount(account: string): Promise<SyncTaskEntity[]> {
    this.requireConfigured();
    const repos = await this.githubService.listReposForAccount(account);
    const tasks: SyncTaskEntity[] = [];
    for (const repo of repos) {
      tasks.push(await this.enqueueUpsertAndSync(repo.full_name));
    }
    return tasks;
  }

  async addRepository(fullName: string): Promise<SyncTaskEntity> {
    this.requireConfigured();
    return this.enqueueUpsertAndSync(fullName);
  }

  async updateBranches(id: number, branches: string[]): Promise<RepositorySyncEntity> {
    const target = await this.repositorySyncRepo.findOneByOrFail({ id });
    target.branches = this.normalizeBranches(branches, target.defaultBranch);
    return this.repositorySyncRepo.save(target);
  }

  async syncOne(id: number): Promise<SyncTaskEntity> {
    this.requireConfigured();
    const target = await this.repositorySyncRepo.findOneByOrFail({ id });
    return this.syncQueueService.enqueue(target.fullName, () => this.syncEntity(target));
  }

  async list(): Promise<RepositorySyncEntity[]> {
    return this.repositorySyncRepo.find({ order: { fullName: 'ASC' } });
  }

  async listTasks(limit?: number): Promise<SyncTaskEntity[]> {
    return this.syncQueueService.listTasks(limit);
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
        const target = entity;
        await this.syncQueueService.enqueue(entity.fullName, () => this.syncEntity(target));
      }
    }
  }

  private async enqueueUpsertAndSync(fullName: string): Promise<SyncTaskEntity> {
    // Ensure the entity exists in the DB before enqueuing
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
    const saved = entity;
    return this.syncQueueService.enqueue(fullName, () => this.syncEntity(saved));
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
