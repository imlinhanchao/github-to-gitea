import { SyncService } from '../src/modules/sync/sync.service';

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

    const service = new SyncService(repo, { isConfigured: () => true } as any, {} as any, {} as any, {} as any);
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

    const service = new SyncService(repo, { isConfigured: () => true } as any, {} as any, {} as any, {} as any);
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

    const service = new SyncService(repo, configService, githubService, {} as any, {} as any);
    await service.setupWebhook(3, 'https://example.com/api/sync/webhook/github');

    expect(githubService.setupWebhook).toHaveBeenCalledWith('foo/bar', 'https://example.com/api/sync/webhook/github', 'mysecret');
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ webhookConfigured: true }));
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

    const githubService = {
      listStarredReposForAccount: jest.fn().mockResolvedValue([{ full_name: 'alice/repo1', owner: { login: 'alice' }, name: 'repo1' }]),
      getRepo: jest.fn().mockResolvedValue({
        full_name: 'alice/repo1',
        owner: { login: 'alice' },
        name: 'repo1',
        private: false,
        default_branch: 'main',
        pushed_at: '2024-01-01T00:00:00Z',
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

    const service = new SyncService(repo, { isConfigured: () => true } as any, githubService, giteaService, queueService);
    await service.addStarredAccount('star-user');

    expect(githubService.listStarredReposForAccount).toHaveBeenCalledWith('star-user');
    expect(giteaService.ensureUserExists).toHaveBeenCalledWith('star-user');
    expect(giteaService.syncRepository).toHaveBeenCalled();
    expect(giteaService.starRepositoryForUser).toHaveBeenCalledWith('star-user', 'alice', 'repo1');
  });
});
