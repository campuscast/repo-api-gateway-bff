import { Controller, Delete, Get, Post, Put, Param, Query, Body, UseGuards, Req, HttpCode, HttpException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ZoneScopeGuard, PermissionsGuard, RequirePermissions } from '@campuscast/shared-libs';
import { AdminGuard } from '../common/admin.guard';
import { filterByAssignedZones, hasFullZoneAccess, type ZoneAwareUser } from '../common/zone-access';

type AuthenticatedRequest = Request & {
  user?: ZoneAwareUser;
};

@Controller('api/v1/zones')
@UseGuards(JwtAuthGuard, PermissionsGuard)
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
  @RequirePermissions('zones.read')
  async listZones(@Query('page') page = 1, @Query('page_size') pageSize = 20, @Req() req: AuthenticatedRequest) {
    const parsedPage = Math.max(1, Number(page) || 1);
    const parsedPageSize = Math.min(100, Math.max(1, Number(pageSize) || 20));

    if (hasFullZoneAccess(req.user)) {
      return this.proxy(`/zones?page=${parsedPage}&page_size=${parsedPageSize}`, req, 'GET');
    }

    const fullList = await this.proxy('/zones?page=1&page_size=1000', req, 'GET') as {
      data?: Array<{ zone_id: string; name: string; description?: string; created_at?: string }>;
    };
    const filtered = filterByAssignedZones(fullList.data || [], req.user);
    const offset = (parsedPage - 1) * parsedPageSize;

    return {
      data: filtered.slice(offset, offset + parsedPageSize),
      pagination: {
        total: filtered.length,
        page: parsedPage,
        page_size: parsedPageSize,
      },
    };
  }

  @Post()
  @RequirePermissions('zones.write')
  @UseGuards(AdminGuard)
  async createZone(@Body() body: { name: string; description?: string }, @Req() req: AuthenticatedRequest) {
    return this.proxy('/zones', req, 'POST', body);
  }

  @Put(':id')
  @RequirePermissions('zones.write')
  @UseGuards(AdminGuard)
  async updateZone(@Param('id') id: string, @Body() body: { name?: string; description?: string }, @Req() req: AuthenticatedRequest) {
    return this.proxy(`/zones/${id}`, req, 'PUT', body);
  }

  @Delete(':id')
  @RequirePermissions('zones.write')
  @UseGuards(AdminGuard)
  async removeZone(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.proxy(`/zones/${id}`, req, 'DELETE');
  }

  @UseGuards(ZoneScopeGuard)
  @Get(':zoneId/policy')
  @RequirePermissions('zones.read')
  async getPolicy(@Param('zoneId') zoneId: string, @Req() req: AuthenticatedRequest) {
    return this.proxy(`/zones/${zoneId}/policy`, req, 'GET');
  }

  @Post(':zoneId/policy')
  @RequirePermissions('zones.write')
  @UseGuards(AdminGuard)
  async createPolicy(@Param('zoneId') zoneId: string, @Body() body: Record<string, unknown>, @Req() req: AuthenticatedRequest) {
    return this.proxy(`/zones/${zoneId}/policy`, req, 'POST', body);
  }

  @Put(':zoneId/policy')
  @RequirePermissions('zones.write')
  @UseGuards(AdminGuard)
  async updatePolicy(@Param('zoneId') zoneId: string, @Body() body: Record<string, unknown>, @Req() req: AuthenticatedRequest) {
    return this.proxy(`/zones/${zoneId}/policy`, req, 'PUT', body);
  }

  @Get(':zoneId/groups')
  @RequirePermissions('zones.read')
  @UseGuards(ZoneScopeGuard)
  async listGroups(@Param('zoneId') zoneId: string, @Req() req: AuthenticatedRequest) {
    return this.proxy(`/zones/${zoneId}/groups`, req, 'GET');
  }

  @Post(':zoneId/groups')
  @RequirePermissions('zones.write')
  @UseGuards(AdminGuard)
  async createGroup(@Param('zoneId') zoneId: string, @Body() body: { name: string }, @Req() req: AuthenticatedRequest) {
    return this.proxy(`/zones/${zoneId}/groups`, req, 'POST', body);
  }

  @Delete(':zoneId/groups/:groupId')
  @RequirePermissions('zones.write')
  @UseGuards(AdminGuard)
  async removeGroup(@Param('zoneId') zoneId: string, @Param('groupId') groupId: string, @Req() req: AuthenticatedRequest) {
    return this.proxy(`/zones/${zoneId}/groups/${groupId}`, req, 'DELETE');
  }
}

@Controller('api/v1/policy')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PolicyProxyController {
  private readonly zoneServiceUrl = process.env.ZONE_SERVICE_URL || 'http://localhost:3002';

  @Post('check')
  @HttpCode(200)
  @RequirePermissions('zones.read')
  @UseGuards(ZoneScopeGuard)
  async check(
    @Body() body: { user_id?: string; device_id?: string; zone_id: string; action: string; resource_id?: string },
    @Req() req: AuthenticatedRequest,
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
