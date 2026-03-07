import { Controller, Post, Body, HttpCode, HttpException, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('api/v1/auth')
export class AuthProxyController {
  private readonly authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

  private async proxyRequest(path: string, body: Record<string, unknown>, req: Request) {
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

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string }, @Req() req: Request) {
    return this.proxyRequest('/auth/login', body, req);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: { refresh_token: string }, @Req() req: Request) {
    return this.proxyRequest('/auth/refresh', body, req);
  }
}
