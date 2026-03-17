import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  HttpCode, HttpException, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@campuscast/shared-libs';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard)
export class UsersProxyController {
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
  async list(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    const params = new URLSearchParams();
    if (page) params.set('page', page);
    if (pageSize) params.set('page_size', pageSize);
    if (search) params.set('search', search);
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    const qs = params.toString();
    return this.proxy('GET', `/users${qs ? `?${qs}` : ''}`, req);
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Req() req: Request) {
    return this.proxy('GET', `/users/${id}`, req);
  }

  @Post()
  async create(@Body() body: unknown, @Req() req: Request) {
    return this.proxy('POST', '/users', req, body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    return this.proxy('PUT', `/users/${id}`, req, body);
  }

  @Delete(':id')
  @HttpCode(200)
  async deactivate(@Param('id') id: string, @Req() req: Request) {
    return this.proxy('DELETE', `/users/${id}`, req);
  }

  @Post('me/change-password')
  async changePassword(@Body() body: unknown, @Req() req: Request) {
    return this.proxy('POST', '/users/me/change-password', req, body);
  }

  @Post(':id/reset-password')
  async resetPassword(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    return this.proxy('POST', `/users/${id}/reset-password`, req, body);
  }
}
