import { Controller, Post, Get, Body, HttpCode, HttpException, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '@campuscast/shared-libs';
import { randomBytes } from 'crypto';

const ACCESS_TOKEN_COOKIE = 'cc_access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const CSRF_TOKEN_COOKIE = 'csrf_token';

@Controller('api/v1')
export class AuthProxyController {
  private readonly authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

  private parseCookie(req: Request, name: string): string | null {
    const raw = req.headers['cookie'];
    if (!raw) return null;
    const header = String(raw);
    const match = header.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  }

  private isSecureRequest(req: Request): boolean {
    const forwardedProto = req.headers['x-forwarded-proto'];
    return String(forwardedProto || req.protocol) === 'https';
  }

  private setAuthCookies(res: Response, req: Request, payload: Record<string, any>): void {
    const secure = this.isSecureRequest(req);
    if (payload.access_token) {
      const expiresInSec = Number(payload.expires_in || 3600);
      res.cookie(ACCESS_TOKEN_COOKIE, String(payload.access_token), {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: Number.isFinite(expiresInSec) ? expiresInSec * 1000 : 3600 * 1000,
      });
    }

    if (payload.refresh_token) {
      res.cookie(REFRESH_TOKEN_COOKIE, String(payload.refresh_token), {
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
      });
    }

    res.cookie(CSRF_TOKEN_COOKIE, randomBytes(32).toString('hex'), {
      httpOnly: false,
      sameSite: 'lax',
      secure,
      path: '/',
    });
  }

  private clearAuthCookies(res: Response, req: Request): void {
    const secure = this.isSecureRequest(req);
    for (const cookieName of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, CSRF_TOKEN_COOKIE]) {
      res.cookie(cookieName, '', {
        httpOnly: cookieName !== CSRF_TOKEN_COOKIE,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: 0,
      });
    }
  }

  private async proxyPost(path: string, body: Record<string, unknown>, req: Request) {
    const res = await fetch(`${this.authServiceUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
        ...(req.headers['cookie'] ? { cookie: String(req.headers['cookie']) } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    const text = await res.text();
    const payload = text ? JSON.parse(text) : {};
    if (!res.ok) {
      throw new HttpException(payload as Record<string, any>, res.status);
    }
    return payload;
  }

  private async proxyGet(path: string, req: Request) {
    const headers: Record<string, string> = {};
    if (req.headers['authorization']) {
      headers['authorization'] = String(req.headers['authorization']);
    } else {
      const accessToken = this.parseCookie(req, ACCESS_TOKEN_COOKIE);
      if (accessToken) headers['authorization'] = `Bearer ${accessToken}`;
    }
    if (req.headers['x-correlation-id']) headers['x-correlation-id'] = String(req.headers['x-correlation-id']);
    if (req.headers['cookie']) headers['cookie'] = String(req.headers['cookie']);

    const res = await fetch(`${this.authServiceUrl}${path}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000),
    });

    const text = await res.text();
    const payload = text ? JSON.parse(text) : {};
    if (!res.ok) {
      throw new HttpException(payload as Record<string, any>, res.status);
    }
    return payload;
  }

  @Post('auth/login')
  @HttpCode(200)
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.proxyPost('/auth/login', body, req);
    this.setAuthCookies(res, req, payload as Record<string, any>);
    return payload;
  }

  @Post('auth/refresh')
  @HttpCode(200)
  async refresh(
    @Body() body: { refresh_token: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshTokenFromCookie = this.parseCookie(req, REFRESH_TOKEN_COOKIE);
    const payload = await this.proxyPost(
      '/auth/refresh',
      { refresh_token: body?.refresh_token || refreshTokenFromCookie || '' },
      req,
    );
    this.setAuthCookies(res, req, payload as Record<string, any>);
    return payload;
  }

  @Post('auth/logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.proxyPost('/auth/logout', {}, req);
    this.clearAuthCookies(res, req);
    return payload;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    return this.proxyGet('/auth/me', req);
  }
}
