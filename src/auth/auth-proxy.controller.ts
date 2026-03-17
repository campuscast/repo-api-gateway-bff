import { Controller, Post, Get, Body, HttpCode, HttpException, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '@campuscast/shared-libs';

@Controller('api/v1')
export class AuthProxyController {
  private readonly authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

  private async proxyPost(path: string, body: Record<string, unknown>, req: Request) {
    const res = await fetch(`${this.authServiceUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
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
    if (req.headers['authorization']) headers['authorization'] = String(req.headers['authorization']);
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
  async login(@Body() body: { email: string; password: string }, @Req() req: Request) {
    return this.proxyPost('/auth/login', body, req);
  }

  @Post('auth/refresh')
  @HttpCode(200)
  async refresh(@Body() body: { refresh_token: string }, @Req() req: Request) {
    return this.proxyPost('/auth/refresh', body, req);
  }

  @Post('auth/logout')
  @HttpCode(200)
  async logout(@Req() req: Request) {
    return this.proxyPost('/auth/logout', {}, req);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    return this.proxyGet('/auth/me', req);
  }
}
