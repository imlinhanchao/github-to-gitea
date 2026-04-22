import { SyncQueueService } from '../src/modules/sync/sync-queue.service';

describe('SyncQueueService', () => {
  it('returns paged tasks with summary counts', async () => {
    const find = jest.fn().mockResolvedValue([{ id: 101, status: 'running' }]);
    const count = jest.fn().mockResolvedValue(45);
    const getRawMany = jest.fn().mockResolvedValue([
      { status: 'pending', count: '12' },
      { status: 'running', count: '1' },
      { status: 'done', count: '30' },
      { status: 'failed', count: '2' },
    ]);
    const findActive = jest.fn().mockResolvedValue([{ id: 101, repoFullName: 'foo/bar', status: 'running' }]);
    const groupBy = jest.fn().mockReturnValue({ getRawMany });
    const addSelect = jest.fn().mockReturnValue({ groupBy });
    const select = jest.fn().mockReturnValue({ addSelect });
    const createQueryBuilder = jest.fn().mockReturnValue({ select });
    const repo = {
      find: jest.fn().mockImplementation((options) => {
        if (options.where) {
          return findActive();
        }
        return find(options);
      }),
      count,
      createQueryBuilder,
    } as any;

    const service = new SyncQueueService(repo);
    const page = await service.listTasks({ page: 2, pageSize: 20 });

    expect(find).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }));
    expect(page.total).toBe(45);
    expect(page.page).toBe(2);
    expect(page.pageSize).toBe(20);
    expect(page.pageCount).toBe(3);
    expect(page.summary).toEqual({ pending: 12, running: 1, done: 30, failed: 2 });
    expect(page.activeItems).toEqual([{ id: 101, repoFullName: 'foo/bar', status: 'running' }]);
  });

  it('normalizes invalid paging input', async () => {
    const repo = {
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          addSelect: jest.fn().mockReturnValue({
            groupBy: jest.fn().mockReturnValue({
              getRawMany: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    } as any;

    const service = new SyncQueueService(repo);
    const page = await service.listTasks({ page: 0, pageSize: 999 });

    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(200);
    expect(page.pageCount).toBe(1);
    expect(page.summary).toEqual({ pending: 0, running: 0, done: 0, failed: 0 });
  });
});
