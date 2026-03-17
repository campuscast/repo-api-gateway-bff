import { randomBytes } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const ACCESS_TOKEN_COOKIE = 'cc_access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_EXEMPT_PATHS = new Set(['/api/v1/auth/login']);

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = header.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function hasCookieSession(request: Request): boolean {
  const rawCookie = typeof request.headers.cookie === 'string' ? request.headers.cookie : undefined;
  return Boolean(parseCookie(rawCookie, ACCESS_TOKEN_COOKIE) || parseCookie(rawCookie, REFRESH_TOKEN_COOKIE));
}

function isSecureRequest(request: Request): boolean {
  const forwardedProto = request.headers['x-forwarded-proto'];
  return String(forwardedProto || request.protocol) === 'https';
}

function requestPath(request: Request): string {
  const rawPath = request.path || request.originalUrl || request.url || '';
  const queryIndex = rawPath.indexOf('?');
  return queryIndex >= 0 ? rawPath.slice(0, queryIndex) : rawPath;
}

export class CsrfProtectionMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const method = String(request.method || 'GET').toUpperCase();
    const path = requestPath(request);
    if (CSRF_EXEMPT_PATHS.has(path)) {
      return next();
    }

    const rawCookie = typeof request.headers.cookie === 'string' ? request.headers.cookie : undefined;
    const csrfCookie = parseCookie(rawCookie, CSRF_COOKIE);
    const sessionViaCookie = hasCookieSession(request);

    if (sessionViaCookie && !csrfCookie && !MUTATING_METHODS.has(method)) {
      response.cookie(CSRF_COOKIE, randomBytes(32).toString('hex'), {
        httpOnly: false,
        sameSite: 'lax',
        secure: isSecureRequest(request),
        path: '/',
      });
      return next();
    }

    if (!sessionViaCookie || !MUTATING_METHODS.has(method)) {
      return next();
    }

    const headerToken = request.headers[CSRF_HEADER] || request.headers[CSRF_HEADER.toUpperCase()];
    const csrfHeader = Array.isArray(headerToken) ? headerToken[0] : headerToken;

    if (!csrfCookie || !csrfHeader || csrfHeader !== csrfCookie) {
      return response.status(403).json({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Invalid CSRF token',
      });
    }

    return next();
  }
}
