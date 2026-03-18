import {
  Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpException, Req, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from '@campuscast/shared-libs';
import { AdminGuard } from '../common/admin.guard';

@Controller('api/v1/roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
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
  @RequirePermissions('users.read')
  async list(@Req() req: Request) {
    return this.proxy('GET', '/roles', req);
  }

  @Get(':id')
  @RequirePermissions('users.read')
  async getById(@Param('id') id: string, @Req() req: Request) {
    return this.proxy('GET', `/roles/${id}`, req);
  }

  @Post()
  @RequirePermissions('users.write')
  async create(@Body() body: unknown, @Req() req: Request) {
    return this.proxy('POST', '/roles', req, body);
  }

  @Put(':id')
  @RequirePermissions('users.write')
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: Request) {
    return this.proxy('PUT', `/roles/${id}`, req, body);
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions('users.write')
  @UseGuards(AdminGuard)
  async removeRole(@Param('id') id: string, @Req() req: Request) {
    return this.proxy('DELETE', `/roles/${id}`, req);
  }

  @Post('assign')
  @RequirePermissions('users.write')
  async assign(@Body() body: unknown, @Req() req: Request) {
    return this.proxy('POST', '/roles/assign', req, body);
  }

  @Post('remove')
  @RequirePermissions('users.write')
  async removeFromUser(@Body() body: unknown, @Req() req: Request) {
    return this.proxy('POST', '/roles/remove', req, body);
  }
}
