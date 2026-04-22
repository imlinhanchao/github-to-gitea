import { Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RepositorySyncEntity } from '../../entities/repository-sync.entity';
import { StarredAccountEntity } from '../../entities/starred-account.entity';
import { SyncTaskEntity } from '../../entities/sync-task.entity';
import { RuntimeConfigService } from '../../config/config.service';
import { GithubRepository, GithubService } from '../github/github.service';
import { GiteaService } from '../gitea/gitea.service';
import { SyncQueueService, TaskPage } from './sync-queue.service';

@Injectable()
export class SyncService implements OnModuleInit {
  constructor(
    @InjectRepository(RepositorySyncEntity)
    private readonly repositorySyncRepo: Repository<RepositorySyncEntity>,
    @InjectRepository(StarredAccountEntity)
    private readonly starredAccountRepo: Repository<StarredAccountEntity>,
    private readonly configService: RuntimeConfigService,
    private readonly githubService: GithubService,
    private readonly giteaService: GiteaService,
    private readonly syncQueueService: SyncQueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.configService.isConfigured()) {
      return;
    }
    const unsynced = await this.repositorySyncRepo.find({ where: { lastSyncedAt: IsNull(), enabled: true } });
    for (const entity of unsynced) {
      await this.syncQueueService.enqueue(entity.fullName, () => this.syncEntity(entity));
    }
  }

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

  async addAccount(account: string, webhookUrl?: string): Promise<SyncTaskEntity[]> {
    this.requireConfigured();
    const repos = await this.githubService.listReposForAccount(account);
    const tasks: SyncTaskEntity[] = [];
    for (const repo of repos) {
      tasks.push(await this.enqueueUpsertAndSync(repo.full_name, webhookUrl));
    }
    return tasks;
  }

  async addStarredAccount(account: string, ignoredRepos: string[] = [], webhookUrl?: string): Promise<SyncTaskEntity[]> {
    this.requireConfigured();
    const normalizedAccount = account.trim();
    await this.giteaService.ensureUserExists(normalizedAccount);
    const repos = await this.githubService.listStarredReposForAccount(normalizedAccount);
    let starredAccount = await this.starredAccountRepo.findOne({ where: { account: normalizedAccount } });
    if (!starredAccount) {
      starredAccount = this.starredAccountRepo.create({
        account: normalizedAccount,
        ignoredRepos,
        knownStarredRepos: repos.map((r) => r.full_name),
        lastCheckedAt: new Date().toISOString(),
      });
    } else {
      starredAccount.ignoredRepos = ignoredRepos;
      starredAccount.knownStarredRepos = repos.map((r) => r.full_name);
      starredAccount.lastCheckedAt = new Date().toISOString();
    }
    await this.starredAccountRepo.save(starredAccount);
    const ignoredSet = new Set(ignoredRepos);
    const tasks: SyncTaskEntity[] = [];
    for (const repo of repos) {
      if (ignoredSet.has(repo.full_name)) continue;
      tasks.push(
        await this.enqueueUpsertAndSync(repo.full_name, webhookUrl, (entity) =>
          this.giteaService.starRepositoryForUser(normalizedAccount, entity.owner, entity.repo),
        ),
      );
    }
    return tasks;
  }

  async previewStarredRepos(account: string): Promise<GithubRepository[]> {
    this.requireConfigured();
    const normalizedAccount = account.trim();
    const repos = await this.githubService.listStarredReposForAccount(normalizedAccount);
    return repos.sort((a, b) => b.stargazers_count - a.stargazers_count);
  }

  async listStarredAccounts(): Promise<StarredAccountEntity[]> {
    return this.starredAccountRepo.find();
  }

  async updateIgnoredRepos(account: string, ignoredRepos: string[]): Promise<StarredAccountEntity> {
    const starredAccount = await this.starredAccountRepo.findOneByOrFail({ account });
    starredAccount.ignoredRepos = ignoredRepos;
    return this.starredAccountRepo.save(starredAccount);
  }

  async addRepository(fullName: string, webhookUrl?: string): Promise<SyncTaskEntity> {
    this.requireConfigured();
    return this.enqueueUpsertAndSync(fullName, webhookUrl);
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

  async syncAll(): Promise<SyncTaskEntity[]> {
    this.requireConfigured();
    const [entities, activeTasks] = await Promise.all([
      this.repositorySyncRepo.find({ where: { enabled: true }, order: { fullName: 'ASC' } }),
      this.syncQueueService.listActiveTasks(),
    ]);
    const activeRepoNames = new Set(activeTasks.map((task) => task.repoFullName));
    return Promise.all(
      entities.filter((entity) => !activeRepoNames.has(entity.fullName)).map((entity) =>
        this.syncQueueService.enqueue(entity.fullName, () => this.syncEntity(entity)),
      ),
    );
  }

  async setEnabled(id: number, enabled: boolean): Promise<RepositorySyncEntity> {
    const target = await this.repositorySyncRepo.findOneByOrFail({ id });
    target.enabled = enabled;
    return this.repositorySyncRepo.save(target);
  }

  async list(): Promise<RepositorySyncEntity[]> {
    return this.repositorySyncRepo.find({ order: { fullName: 'ASC' } });
  }

  async listTasks(page?: number, pageSize?: number): Promise<TaskPage> {
    return this.syncQueueService.listTasks({ page, pageSize });
  }

  async retryTask(taskId: number): Promise<SyncTaskEntity> {
    this.requireConfigured();
    const task = await this.syncQueueService.getTask(taskId);
    const entity = await this.repositorySyncRepo.findOneByOrFail({ fullName: task.repoFullName });
    return this.syncQueueService.enqueue(entity.fullName, () => this.syncEntity(entity));
  }

  async clearTasks(): Promise<void> {
    await this.syncQueueService.clearTasks();
  }

  async retryAllFailed(): Promise<SyncTaskEntity[]> {
    this.requireConfigured();
    const failedTasks = await this.syncQueueService.listFailedTasks();
    const seen = new Set<string>();
    const results: SyncTaskEntity[] = [];
    for (const task of failedTasks) {
      if (seen.has(task.repoFullName)) continue;
      seen.add(task.repoFullName);
      const entity = await this.repositorySyncRepo.findOne({ where: { fullName: task.repoFullName } });
      if (!entity) continue;
      results.push(await this.syncQueueService.enqueue(entity.fullName, () => this.syncEntity(entity)));
    }
    return results;
  }

  async cancelTask(id: number): Promise<void> {
    return this.syncQueueService.cancelPendingTask(id);
  }

  async setupWebhook(id: number, webhookUrl: string): Promise<void> {
    this.requireConfigured();
    const entity = await this.repositorySyncRepo.findOneByOrFail({ id });
    const config = this.configService.getConfigOrNull();
    await this.githubService.setupWebhook(entity.fullName, webhookUrl, config?.webhookSecret || undefined);
    entity.webhookConfigured = true;
    await this.repositorySyncRepo.save(entity);
  }

  async syncByFullName(fullName: string): Promise<SyncTaskEntity | null> {
    this.requireConfigured();
    const entity = await this.repositorySyncRepo.findOne({ where: { fullName, enabled: true } });
    return entity ? this.syncQueueService.enqueue(entity.fullName, () => this.syncEntity(entity)) : null;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async syncUpdatedRepositories(): Promise<void> {
    if (!this.configService.isConfigured()) {
      return;
    }
    const all = await this.repositorySyncRepo.find({ where: { enabled: true } });
    for (const entity of all) {
      const githubRepo = await this.githubService.getRepo(entity.fullName);
      const pushedAt = githubRepo.pushed_at;
      if (!entity.lastGithubPushedAt || new Date(pushedAt) > new Date(entity.lastGithubPushedAt)) {
        await this.syncQueueService.enqueue(entity.fullName, () => this.syncEntity(entity));
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkNewStars(): Promise<void> {
    if (!this.configService.isConfigured()) {
      return;
    }
    const accounts = await this.starredAccountRepo.find();
    for (const starredAccount of accounts) {
      try {
        const repos = await this.githubService.listStarredReposForAccount(starredAccount.account);
        const knownSet = new Set(starredAccount.knownStarredRepos);
        const ignoredSet = new Set(starredAccount.ignoredRepos);
        const newRepos = repos.filter((r) => !knownSet.has(r.full_name) && !ignoredSet.has(r.full_name));
        for (const repo of newRepos) {
          const account = starredAccount.account;
          await this.enqueueUpsertAndSync(repo.full_name, undefined, (entity) =>
            this.giteaService.starRepositoryForUser(account, entity.owner, entity.repo),
          );
        }
        starredAccount.knownStarredRepos = repos.map((r) => r.full_name);
        starredAccount.lastCheckedAt = new Date().toISOString();
        await this.starredAccountRepo.save(starredAccount);
      } catch {
        // Ignore errors per-account to allow others to proceed
      }
    }
  }

  private async enqueueUpsertAndSync(
    fullName: string,
    webhookUrl?: string,
    postSync?: (entity: RepositorySyncEntity) => Promise<void>,
  ): Promise<SyncTaskEntity> {
    let entity = await this.repositorySyncRepo.findOne({ where: { fullName } });
    const isNew = !entity;
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
    if (isNew && webhookUrl && !entity.webhookConfigured) {
      await this.trySetupWebhook(entity, webhookUrl);
    }
    const saved = entity;
    return this.syncQueueService.enqueue(fullName, async () => {
      const synced = await this.syncEntity(saved);
      if (postSync) {
        await postSync(synced);
      }
    });
  }

  private async trySetupWebhook(entity: RepositorySyncEntity, webhookUrl: string): Promise<void> {
    try {
      const config = this.configService.getConfigOrNull();
      await this.githubService.setupWebhook(entity.fullName, webhookUrl, config?.webhookSecret || undefined);
      entity.webhookConfigured = true;
      await this.repositorySyncRepo.save(entity);
    } catch {
      // Silently ignore webhook setup failures
    }
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
