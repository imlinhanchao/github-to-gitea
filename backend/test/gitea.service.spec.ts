import { GiteaService } from '../src/modules/gitea/gitea.service';

describe('GiteaService', () => {
  const configService = {
    loadConfig: jest.fn().mockReturnValue({
      giteaBaseUrl: 'https://gitea.example.com',
      giteaToken: 'token',
      giteaAdminPassword: 'admin-password',
    }),
  } as any;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('normalizes username when ensuring user exists', async () => {
    const service = new GiteaService(configService);
    const ensureUserSpy = jest.spyOn(service as any, 'ensureUser').mockResolvedValue(undefined);

    await service.ensureUserExists('  alice  ');

    expect(ensureUserSpy).toHaveBeenCalledWith('alice');
  });

  it('stars repository for target user via sudo header', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValueOnce({ ok: true, status: 204 } as any);
    const service = new GiteaService(configService);

    await service.starRepositoryForUser('alice', 'org', 'repo');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://gitea.example.com/api/v1/user/starred/org/repo',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: 'token token',
          Sudo: 'alice',
        }),
      }),
    );
  });
});
