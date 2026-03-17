import { CsrfProtectionMiddleware } from '../src/common/csrf.middleware';

describe('CsrfProtectionMiddleware', () => {
  const middleware = new CsrfProtectionMiddleware();

  function createResponse() {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn(),
    };
    return response;
  }

  it('allows mutating cookie-auth request when csrf header matches cookie', () => {
    const request: any = {
      method: 'POST',
      path: '/api/v1/users/me/change-password',
      protocol: 'http',
      headers: {
        cookie: 'cc_access_token=token-1; csrf_token=csrf-1',
        'x-csrf-token': 'csrf-1',
      },
    };
    const response = createResponse();
    const next = jest.fn();

    middleware.use(request, response as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('rejects mutating cookie-auth request with missing csrf header', () => {
    const request: any = {
      method: 'POST',
      path: '/api/v1/users/me/change-password',
      protocol: 'http',
      headers: {
        cookie: 'cc_access_token=token-1; csrf_token=csrf-1',
      },
    };
    const response = createResponse();
    const next = jest.fn();

    middleware.use(request, response as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: 'Invalid CSRF token',
      }),
    );
  });

  it('does not enforce csrf for bearer-only mutating requests without auth cookies', () => {
    const request: any = {
      method: 'POST',
      path: '/api/v1/roles',
      protocol: 'http',
      headers: {
        authorization: 'Bearer token-1',
      },
    };
    const response = createResponse();
    const next = jest.fn();

    middleware.use(request, response as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('skips csrf validation for login endpoint', () => {
    const request: any = {
      method: 'POST',
      path: '/api/v1/auth/login',
      protocol: 'http',
      headers: {
        cookie: 'refresh_token=legacy-token',
      },
    };
    const response = createResponse();
    const next = jest.fn();

    middleware.use(request, response as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it('issues csrf cookie on safe request when session cookie exists but csrf cookie is missing', () => {
    const request: any = {
      method: 'GET',
      path: '/api/v1/me',
      protocol: 'http',
      headers: {
        cookie: 'cc_access_token=token-1',
      },
    };
    const response = createResponse();
    const next = jest.fn();

    middleware.use(request, response as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.cookie).toHaveBeenCalledWith(
      'csrf_token',
      expect.any(String),
      expect.objectContaining({
        httpOnly: false,
        sameSite: 'lax',
      }),
    );
  });
});
