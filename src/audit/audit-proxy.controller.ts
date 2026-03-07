import { Controller, Get, Query, Req, UseGuards, HttpException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@campuscast/shared-libs';

@Controller('api/v1/audit')
@UseGuards(JwtAuthGuard)
export class AuditProxyController {
  private readonly auditServiceUrl = process.env.AUDIT_SERVICE_URL || 'http://audit-service:3009';

  @Get()
  async queryEvents(@Query() query: Record<string, string | string[] | undefined>, @Req() req?: Request) {
    const upstreamUrl = new URL(`${this.auditServiceUrl}/audit`);
    const rawQuery = req?.originalUrl?.includes('?')
      ? req.originalUrl.slice(req.originalUrl.indexOf('?'))
      : '';

    if (rawQuery) {
      upstreamUrl.search = rawQuery;
    } else {
      for (const [key, value] of Object.entries(query)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item !== undefined) upstreamUrl.searchParams.append(key, String(item));
          }
          continue;
        }
        if (value !== undefined) upstreamUrl.searchParams.append(key, String(value));
      }
    }

    const res = await fetch(upstreamUrl.toString(), {
      headers: {
        ...(req?.headers['authorization'] ? { authorization: String(req.headers['authorization']) } : {}),
        ...(req?.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });
    const payload = await res.json();
    if (!res.ok) throw new HttpException(payload as Record<string, any>, res.status);
    return payload;
  }
}
