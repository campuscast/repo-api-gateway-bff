import type { NextFunction, Request, Response } from 'express';

type RateLimitRule = {
  key: string;
  method: string;
  path: RegExp;
  limit: number;
  windowMs: number;
  message: string;
};

type RateWindowState = {
  count: number;
  resetAt: number;
};

const DEFAULT_RULES: RateLimitRule[] = [
  {
    key: 'auth.login',
    method: 'POST',
    path: /^\/api\/v1\/auth\/login$/,
    limit: 5,
    windowMs: 60_000,
    message: 'Too many login attempts. Please retry in a minute.',
  },
  {
    key: 'users.change_password',
    method: 'POST',
    path: /^\/api\/v1\/users\/me\/change-password$/,
    limit: 8,
    windowMs: 10 * 60_000,
    message: 'Too many password change attempts. Please retry later.',
  },
  {
    key: 'users.reset_password',
    method: 'POST',
    path: /^\/api\/v1\/users\/[^/]+\/reset-password$/,
    limit: 8,
    windowMs: 10 * 60_000,
    message: 'Too many password reset attempts. Please retry later.',
  },
];

function clientKey(request: Request): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }

  return request.ip || request.socket.remoteAddress || 'unknown';
}

function requestPath(request: Request): string {
  const rawPath = request.path || request.originalUrl || request.url || '';
  const queryIndex = rawPath.indexOf('?');
  return queryIndex >= 0 ? rawPath.slice(0, queryIndex) : rawPath;
}

export class AuthRateLimitMiddleware {
  private readonly state = new Map<string, RateWindowState>();

  constructor(
    private readonly rules: RateLimitRule[] = DEFAULT_RULES,
    private readonly now: () => number = () => Date.now(),
  ) {}

  use(request: Request, response: Response, next: NextFunction) {
    const method = String(request.method || '').toUpperCase();
    const path = requestPath(request);
    const rule = this.rules.find((candidate) => candidate.method === method && candidate.path.test(path));

    if (!rule) {
      return next();
    }

    const now = this.now();
    const key = `${rule.key}:${clientKey(request)}`;
    const entry = this.state.get(key);

    if (!entry || now >= entry.resetAt) {
      this.state.set(key, {
        count: 1,
        resetAt: now + rule.windowMs,
      });
      this.cleanup(now);
      return next();
    }

    entry.count += 1;
    this.state.set(key, entry);

    if (entry.count > rule.limit) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      response.setHeader('Retry-After', String(retryAfterSec));
      return response.status(429).json({
        statusCode: 429,
        error: 'Too Many Requests',
        message: rule.message,
      });
    }

    return next();
  }

  private cleanup(now: number) {
    if (this.state.size < 500) {
      return;
    }

    for (const [key, value] of this.state.entries()) {
      if (value.resetAt <= now) {
        this.state.delete(key);
      }
    }
  }
}

export type { RateLimitRule };
