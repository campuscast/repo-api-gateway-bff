import { Controller, Get, HttpException, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('api/v1/system')
export class SystemProxyController {
  private readonly authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

  @Get('init-state')
  async getInitState(@Req() req: Request) {
    const res = await fetch(`${this.authServiceUrl}/system/init-state`, {
      method: 'GET',
      headers: {
        ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });

    const text = await res.text();
    const payload = text ? JSON.parse(text) : {};
    if (!res.ok) throw new HttpException(payload, res.status);
    return payload;
  }
}
