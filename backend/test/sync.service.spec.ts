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

    const service = new SyncService(repo, {} as any, {} as any);
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

    const service = new SyncService(repo, {} as any, {} as any);
    const updated = await service.updateBranches(2, [' ']);

    expect(updated.branches).toEqual(['master']);
  });
});
