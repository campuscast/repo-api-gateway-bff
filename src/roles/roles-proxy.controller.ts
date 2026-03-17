import {
  Controller, Get, Post, Put, Body, Param, HttpException, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@campuscast/shared-libs';

@Controller('api/v1/roles')
@UseGuards(JwtAuthGuard)
export class RolesProxyController {
  private readonly authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

  private buildHeaders(req: Request): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (req.headers['authorization']) headers['authorization'] = String(req.headers['authorization']);
    if (req.headers['x-correlation-id']) headers['x-correlation-id'] = String(req.headers['x-correlation-id']);
    if (req.headers['cookie']) headers['cookie'] = String(req.headers['cookie']);
    return headers;
  }

  private async proxy(method: string, path: string, req: Request, body?: unknown) {
    const res = await fetch(`${this.authServiceUrl}${path}`, {
      method,
      headers: this.buildHeaders(req),
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000),
    });
    const text = await res.text();
    const payload = text ? JSON.parse(text) : {};
    if (!res.ok) throw new HttpException(payload, res.status);
    return payload;
  }

  @Get()
  async list(@Req() req: Request) {
    return this.proxy('GET', '/roles', req);
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Req() req: Request) {
    return this.proxy('GET', `/roles/${id}`, req);
  }

  @Post()
  async create(@Body() body: unknown, @Req() req: Request) {
    return this.proxy('POST', '/roles', req, body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    return this.proxy('PUT', `/roles/${id}`, req, body);
  }

  @Post('assign')
  async assign(@Body() body: unknown, @Req() req: Request) {
    return this.proxy('POST', '/roles/assign', req, body);
  }

  @Post('remove')
  async remove(@Body() body: unknown, @Req() req: Request) {
    return this.proxy('POST', '/roles/remove', req, body);
  }
}
