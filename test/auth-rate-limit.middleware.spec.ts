import { AuthRateLimitMiddleware, type RateLimitRule } from '../src/common/auth-rate-limit.middleware';

describe('AuthRateLimitMiddleware', () => {
  function createResponse() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
    };
  }

  it('returns 429 when attempts exceed route limit and allows again after window reset', () => {
    const rule: RateLimitRule = {
      key: 'auth.login',
      method: 'POST',
      path: /^\/api\/v1\/auth\/login$/,
      limit: 2,
      windowMs: 10_000,
      message: 'Too many login attempts.',
    };

    let now = 1_000;
    const middleware = new AuthRateLimitMiddleware([rule], () => now);
    const request: any = {
      method: 'POST',
      path: '/api/v1/auth/login',
      headers: { 'x-forwarded-for': '10.0.0.1' },
      ip: '10.0.0.1',
      socket: { remoteAddress: '10.0.0.1' },
    };

    const firstRes = createResponse();
    const firstNext = jest.fn();
    middleware.use(request, firstRes as any, firstNext);
    expect(firstNext).toHaveBeenCalledTimes(1);

    const secondRes = createResponse();
    const secondNext = jest.fn();
    middleware.use(request, secondRes as any, secondNext);
    expect(secondNext).toHaveBeenCalledTimes(1);

    const thirdRes = createResponse();
    const thirdNext = jest.fn();
    middleware.use(request, thirdRes as any, thirdNext);
    expect(thirdNext).not.toHaveBeenCalled();
    expect(thirdRes.status).toHaveBeenCalledWith(429);
    expect(thirdRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));

    now += 11_000;
    const afterWindowRes = createResponse();
    const afterWindowNext = jest.fn();
    middleware.use(request, afterWindowRes as any, afterWindowNext);
    expect(afterWindowNext).toHaveBeenCalledTimes(1);
  });

  it('ignores routes that are not configured for throttling', () => {
    const middleware = new AuthRateLimitMiddleware();
    const request: any = {
      method: 'GET',
      path: '/api/v1/users',
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    const response = createResponse();
    const next = jest.fn();

    middleware.use(request, response as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });
});
