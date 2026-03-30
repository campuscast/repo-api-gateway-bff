import { ScheduleProxyController } from '../src/schedule/schedule-proxy.controller';

function mockJsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

describe('ScheduleProxyController', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it('hides lock_token for users who do not own the lock', async () => {
    const controller = new ScheduleProxyController();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse(200, { schedule_id: 'schedule-1', zone_id: 'zone-1' }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse(200, {
          schedule_id: 'schedule-1',
          zone_id: 'zone-1',
          locked_by: 'owner-1',
          lock_token: 'secret-token',
          status: 'draft',
          slots: [],
        }),
      );

    const result = await controller.getById('schedule-1', {
      headers: {},
      user: { sub: 'user-2', zone_ids: ['zone-1'] },
    } as any);

    expect((result as any).locked_by).toBe('owner-1');
    expect((result as any).lock_token).toBe('');
  });

  it('keeps lock_token for lock owner', async () => {
    const controller = new ScheduleProxyController();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse(200, { schedule_id: 'schedule-1', zone_id: 'zone-1' }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse(200, {
          schedule_id: 'schedule-1',
          zone_id: 'zone-1',
          locked_by: 'owner-1',
          lock_token: 'secret-token',
          status: 'draft',
          slots: [],
        }),
      );

    const result = await controller.getById('schedule-1', {
      headers: {},
      user: { sub: 'owner-1', zone_ids: ['zone-1'] },
    } as any);

    expect((result as any).lock_token).toBe('secret-token');
  });

  it('proxies delete schedule request after zone access check', async () => {
    const controller = new ScheduleProxyController();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse(200, { schedule_id: 'schedule-1', zone_id: 'zone-1' }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse(200, { deleted: true, schedule_id: 'schedule-1' }),
      );

    const result = await controller.deleteById('schedule-1', {
      headers: {},
      user: { sub: 'owner-1', zone_ids: ['zone-1'] },
    } as any);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const deleteCall = (global.fetch as jest.Mock).mock.calls[1];
    expect(deleteCall[0]).toContain('/schedules/schedule-1');
    expect(deleteCall[1]).toMatchObject({ method: 'DELETE' });
    expect(result).toEqual({ deleted: true, schedule_id: 'schedule-1' });
  });

  it('proxies lock refresh request with lock token payload', async () => {
    const controller = new ScheduleProxyController();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        mockJsonResponse(200, { schedule_id: 'schedule-1', zone_id: 'zone-1' }),
      )
      .mockResolvedValueOnce(
        mockJsonResponse(200, {
          refreshed: true,
          lock_token: 'token-1',
          locked_by: 'owner-1',
          expires_at: '2026-03-25T10:10:00.000Z',
        }),
      );

    const result = await controller.refreshLock(
      'schedule-1',
      { lock_token: 'token-1', ttl_seconds: 600 },
      {
        headers: {},
        user: { sub: 'owner-1', zone_ids: ['zone-1'] },
      } as any,
    );

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const refreshCall = (global.fetch as jest.Mock).mock.calls[1];
    expect(refreshCall[0]).toContain('/schedules/schedule-1/lock/refresh');
    expect(refreshCall[1]).toMatchObject({ method: 'POST' });
    expect(result).toEqual({
      refreshed: true,
      lock_token: 'token-1',
      locked_by: 'owner-1',
      expires_at: '2026-03-25T10:10:00.000Z',
    });
  });
});
