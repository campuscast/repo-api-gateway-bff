import { Controller, Delete, Get, Post, Put, Param, Query, Body, UseGuards, Req, HttpCode, HttpException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ZoneScopeGuard } from '@campuscast/shared-libs';
import { AdminGuard } from '../common/admin.guard';

@Controller('api/v1/zones')
@UseGuards(JwtAuthGuard)
export class ZonesProxyController {
  private readonly zoneServiceUrl = process.env.ZONE_SERVICE_URL || 'http://localhost:3002';

  private async proxy(
    path: string,
    req: Request,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: Record<string, unknown>,
  ) {
    const res = await fetch(`${this.zoneServiceUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(req.headers['authorization'] ? { authorization: String(req.headers['authorization']) } : {}),
        ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(5000),
    });

    const text = await res.text();
    const payload = text ? JSON.parse(text) : {};
    if (!res.ok) throw new HttpException(payload as Record<string, any>, res.status);
    return payload;
  }

  @Get()
  @UseGuards(AdminGuard)
  async listZones(@Query('page') page = 1, @Query('page_size') pageSize = 20, @Req() req: Request) {
    return this.proxy(`/zones?page=${page}&page_size=${pageSize}`, req, 'GET');
  }

  @Post()
  @UseGuards(AdminGuard)
  async createZone(@Body() body: { name: string; description?: string }, @Req() req: Request) {
    return this.proxy('/zones', req, 'POST', body);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  async updateZone(@Param('id') id: string, @Body() body: { name?: string; description?: string }, @Req() req: Request) {
    return this.proxy(`/zones/${id}`, req, 'PUT', body);
  }

  @UseGuards(ZoneScopeGuard)
  @Get(':zoneId/policy')
  async getPolicy(@Param('zoneId') zoneId: string, @Req() req: Request) {
    return this.proxy(`/zones/${zoneId}/policy`, req, 'GET');
  }

  @Post(':zoneId/policy')
  @UseGuards(AdminGuard)
  async createPolicy(@Param('zoneId') zoneId: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.proxy(`/zones/${zoneId}/policy`, req, 'POST', body);
  }

  @Put(':zoneId/policy')
  @UseGuards(AdminGuard)
  async updatePolicy(@Param('zoneId') zoneId: string, @Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.proxy(`/zones/${zoneId}/policy`, req, 'PUT', body);
  }

  @Get(':zoneId/groups')
  @UseGuards(AdminGuard)
  async listGroups(@Param('zoneId') zoneId: string, @Req() req: Request) {
    return this.proxy(`/zones/${zoneId}/groups`, req, 'GET');
  }

  @Post(':zoneId/groups')
  @UseGuards(AdminGuard)
  async createGroup(@Param('zoneId') zoneId: string, @Body() body: { name: string }, @Req() req: Request) {
    return this.proxy(`/zones/${zoneId}/groups`, req, 'POST', body);
  }

  @Delete(':zoneId/groups/:groupId')
  @UseGuards(AdminGuard)
  async removeGroup(@Param('zoneId') zoneId: string, @Param('groupId') groupId: string, @Req() req: Request) {
    return this.proxy(`/zones/${zoneId}/groups/${groupId}`, req, 'DELETE');
  }
}

@Controller('api/v1/policy')
@UseGuards(JwtAuthGuard)
export class PolicyProxyController {
  private readonly zoneServiceUrl = process.env.ZONE_SERVICE_URL || 'http://localhost:3002';

  @Post('check')
  @HttpCode(200)
  @UseGuards(ZoneScopeGuard)
  async check(
    @Body() body: { user_id?: string; device_id?: string; zone_id: string; action: string; resource_id?: string },
    @Req() req: Request,
  ) {
    const res = await fetch(`${this.zoneServiceUrl}/policy/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers['authorization'] ? { authorization: String(req.headers['authorization']) } : {}),
        ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    const payload = await res.json();
    if (!res.ok) throw new HttpException(payload as Record<string, any>, res.status);
    return payload;
  }
}
