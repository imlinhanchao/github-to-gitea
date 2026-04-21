import { GithubService } from '../src/modules/github/github.service';

describe('GithubService', () => {
  const configService = {
    loadConfig: jest.fn().mockReturnValue({ githubToken: 'token' }),
  } as any;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns accessible private/public repos for account from /user/repos', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { full_name: 'alice/a', owner: { login: 'alice' } },
          { full_name: 'bob/b', owner: { login: 'bob' } },
        ],
      } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as any);

    const service = new GithubService(configService);
    const result = await service.listReposForAccount('alice');

    expect(result).toHaveLength(1);
    expect(result[0].full_name).toBe('alice/a');
    const calledUrls = fetchMock.mock.calls.map((call: any[]) => String(call[0]));
    expect(calledUrls).toContain(
      'https://api.github.com/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&per_page=100&page=1',
    );
  });

  it('falls back to public user repos when account is not accessible', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ full_name: 'charlie/c', owner: { login: 'charlie' } }],
      } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as any);

    const service = new GithubService(configService);
    const result = await service.listReposForAccount('charlie');

    expect(result).toHaveLength(1);
    expect(result[0].full_name).toBe('charlie/c');
    const calledUrls = fetchMock.mock.calls.map((call: any[]) => String(call[0]));
    expect(calledUrls).toContain('https://api.github.com/users/charlie/repos?type=all&per_page=100&page=1');
  });

  it('lists starred repos for account', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ full_name: 'foo/bar', owner: { login: 'foo' } }],
      } as any)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as any);

    const service = new GithubService(configService);
    const result = await service.listStarredReposForAccount('foo');

    expect(result).toHaveLength(1);
    expect(result[0].full_name).toBe('foo/bar');
    const calledUrls = fetchMock.mock.calls.map((call: any[]) => String(call[0]));
    expect(calledUrls).toContain('https://api.github.com/users/foo/starred?sort=updated&direction=desc&per_page=100&page=1');
  });
});
