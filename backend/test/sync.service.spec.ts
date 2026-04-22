import { SyncService } from '../src/modules/sync/sync.service';

const mockStarredAccountRepo = {
  findOne: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockImplementation(async (item: unknown) => item),
  create: jest.fn().mockImplementation((item: unknown) => item),
  find: jest.fn().mockResolvedValue([]),
  findOneByOrFail: jest.fn(),
} as any;

describe('SyncService', () => {
  it('updates branches with dedupe and trims spaces', async () => {
    const entity = {
      id: 1,
      fullName: 'foo/bar',
      defaultBranch: 'main',
      branches: ['main'],
    } as any;

    const repo = {
      findOneByOrFail: jest.fn().mockResolvedValue(entity),
      save: jest.fn().mockImplementation(async (item) => item),
    } as any;

    const service = new SyncService(repo, mockStarredAccountRepo, { isConfigured: () => true } as any, {} as any, {} as any, {} as any);
    const updated = await service.updateBranches(1, [' main ', 'dev', 'dev', '']);

    expect(updated.branches).toEqual(['main', 'dev']);
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ branches: ['main', 'dev'] }));
  });

  it('falls back to default branch if empty input', async () => {
    const entity = {
      id: 2,
      fullName: 'foo/bar',
      defaultBranch: 'master',
      branches: ['main'],
    } as any;

    const repo = {
      findOneByOrFail: jest.fn().mockResolvedValue(entity),
      save: jest.fn().mockImplementation(async (item) => item),
    } as any;

    const service = new SyncService(repo, mockStarredAccountRepo, { isConfigured: () => true } as any, {} as any, {} as any, {} as any);
    const updated = await service.updateBranches(2, [' ']);

    expect(updated.branches).toEqual(['master']);
  });

  it('sets webhookConfigured=true and saves after setupWebhook succeeds', async () => {
    const entity = {
      id: 3,
      fullName: 'foo/bar',
      webhookConfigured: false,
    } as any;

    const repo = {
      findOneByOrFail: jest.fn().mockResolvedValue(entity),
      save: jest.fn().mockImplementation(async (item) => item),
    } as any;

    const githubService = {
      setupWebhook: jest.fn().mockResolvedValue(undefined),
    } as any;

    const configService = {
      isConfigured: () => true,
      getConfigOrNull: () => ({ webhookSecret: 'mysecret' }),
    } as any;

    const service = new SyncService(repo, mockStarredAccountRepo, configService, githubService, {} as any, {} as any);
    await service.setupWebhook(3, 'https://example.com/api/sync/webhook/github');

    expect(githubService.setupWebhook).toHaveBeenCalledWith('foo/bar', 'https://example.com/api/sync/webhook/github', 'mysecret');
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ webhookConfigured: true }));
  });

  it('syncs all enabled repos and skips active tasks', async () => {
    const activeRepo = { id: 1, fullName: 'foo/active', enabled: true } as any;
    const idleRepo = { id: 2, fullName: 'foo/idle', enabled: true } as any;
    const repo = {
      find: jest.fn().mockResolvedValue([activeRepo, idleRepo]),
    } as any;
    const queueService = {
      listActiveTasks: jest.fn().mockResolvedValue([{ id: 99, repoFullName: 'foo/active', status: 'running' }]),
      enqueue: jest.fn().mockResolvedValue({ id: 100 } as any),
    } as any;

    const service = new SyncService(repo, mockStarredAccountRepo, { isConfigured: () => true } as any, {} as any, {} as any, queueService);
    const tasks = await service.syncAll();

    expect(repo.find).toHaveBeenCalledWith({ where: { enabled: true }, order: { fullName: 'ASC' } });
    expect(queueService.enqueue).toHaveBeenCalledTimes(1);
    expect(queueService.enqueue).toHaveBeenCalledWith('foo/idle', expect.any(Function));
    expect(tasks).toHaveLength(1);
  });

  it('syncs starred account repos and stars them in gitea', async () => {
    const syncEntity = {
      id: 10,
      fullName: 'alice/repo1',
      owner: 'alice',
      repo: 'repo1',
      isPrivate: false,
      defaultBranch: 'main',
      branches: ['main'],
      webhookConfigured: false,
      lastGithubPushedAt: null,
      lastSyncedAt: null,
      enabled: true,
    } as any;

    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (item) => item),
      create: jest.fn().mockImplementation((item) => ({ ...syncEntity, ...item })),
    } as any;

    const starredRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (item) => item),
      create: jest.fn().mockImplementation((item: unknown) => item),
      find: jest.fn().mockResolvedValue([]),
    } as any;

    const githubService = {
      listStarredReposForAccount: jest.fn().mockResolvedValue([{ full_name: 'alice/repo1', owner: { login: 'alice' }, name: 'repo1', stargazers_count: 100 }]),
      getRepo: jest.fn().mockResolvedValue({
        full_name: 'alice/repo1',
        owner: { login: 'alice' },
        name: 'repo1',
        private: false,
        default_branch: 'main',
        pushed_at: '2024-01-01T00:00:00Z',
        stargazers_count: 100,
      }),
    } as any;

    const giteaService = {
      ensureUserExists: jest.fn().mockResolvedValue(undefined),
      syncRepository: jest.fn().mockResolvedValue(undefined),
      starRepositoryForUser: jest.fn().mockResolvedValue(undefined),
    } as any;

    const queueService = {
      enqueue: jest.fn().mockImplementation(async (_fullName, fn) => {
        await fn();
        return { id: 1 } as any;
      }),
    } as any;

    const service = new SyncService(repo, starredRepo, { isConfigured: () => true } as any, githubService, giteaService, queueService);
    await service.addStarredAccount('star-user');

    expect(githubService.listStarredReposForAccount).toHaveBeenCalledWith('star-user');
    expect(giteaService.ensureUserExists).toHaveBeenCalledWith('star-user');
    expect(giteaService.syncRepository).toHaveBeenCalled();
    expect(giteaService.starRepositoryForUser).toHaveBeenCalledWith('star-user', 'alice', 'repo1');
  });
});
