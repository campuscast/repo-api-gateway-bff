import { ReleasesProxyController } from '../src/releases/releases-proxy.controller';

function mockResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(payload)),
  } as unknown as Response;
}

describe('ReleasesProxyController', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it('filters release rows by assigned zones', async () => {
    const controller = new ReleasesProxyController();
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse(200, {
        data: [
          { release_id: 'r-1', zone_id: 'zone-1' },
          { release_id: 'r-2', zone_id: 'zone-2' },
        ],
        pagination: { total: 2, page: 1, page_size: 20 },
      }),
    );

    const result = await controller.list(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      20,
      {
        headers: {},
        user: { zone_ids: ['zone-1'] },
      } as any,
    );

    expect(result.data).toHaveLength(1);
    expect((result.data[0] as any).release_id).toBe('r-1');
  });
});
