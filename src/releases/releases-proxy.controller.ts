import { Controller, Delete, Get, HttpException, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from '@campuscast/shared-libs';
import { assertZoneAccess, filterByAssignedZones, type ZoneAwareUser } from '../common/zone-access';

type AuthenticatedRequest = Request & {
  user?: ZoneAwareUser;
};

@Controller('api/v1/releases')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReleasesProxyController {
  private readonly scheduleServiceUrl = process.env.SCHEDULE_SERVICE_URL || 'http://localhost:3005';

  private async proxy(path: string, req: Request, method: 'GET' | 'DELETE' = 'GET') {
    const res = await fetch(`${this.scheduleServiceUrl}${path}`, {
      method,
      headers: {
        ...(req.headers['authorization'] ? { authorization: String(req.headers['authorization']) } : {}),
        ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
      },
      signal: AbortSignal.timeout(7000),
    });
    const text = await res.text();
    const payload = text ? JSON.parse(text) : {};
    if (!res.ok) throw new HttpException(payload as Record<string, any>, res.status);
    return payload;
  }

  private async ensureReleaseZoneAccess(releaseId: string, req: AuthenticatedRequest): Promise<void> {
    const release = await this.proxy(`/releases/${encodeURIComponent(releaseId)}`, req) as { zone_id?: string };
    assertZoneAccess(req.user, release.zone_id, `release:${releaseId}`);
  }

  @Get()
  @RequirePermissions('schedules.read')
  async list(
    @Query('schedule_id') scheduleId: string | undefined,
    @Query('zone_id') zoneId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('published_from') publishedFrom: string | undefined,
    @Query('published_to') publishedTo: string | undefined,
    @Query('page') page = 1,
    @Query('page_size') pageSize = 20,
    @Req() req: AuthenticatedRequest,
  ) {
    if (zoneId) {
      assertZoneAccess(req.user, zoneId, `releases:list:zone:${zoneId}`);
    }
    const params = new URLSearchParams();
    if (scheduleId) params.set('schedule_id', scheduleId);
    if (zoneId) params.set('zone_id', zoneId);
    if (status) params.set('status', status);
    if (publishedFrom) params.set('published_from', publishedFrom);
    if (publishedTo) params.set('published_to', publishedTo);
    params.set('page', String(page));
    params.set('page_size', String(pageSize));

    const payload = await this.proxy(`/releases?${params.toString()}`, req) as {
      data?: Array<{ zone_id: string }>;
      pagination?: { total: number; page: number; page_size: number };
    };
    const data = filterByAssignedZones(payload.data || [], req.user);
    return {
      data,
      pagination: payload.pagination || {
        total: data.length,
        page: Number(page),
        page_size: Number(pageSize),
      },
    };
  }

  @Get(':releaseId')
  @RequirePermissions('schedules.read')
  async getById(@Param('releaseId') releaseId: string, @Req() req: AuthenticatedRequest) {
    await this.ensureReleaseZoneAccess(releaseId, req);
    return this.proxy(`/releases/${encodeURIComponent(releaseId)}`, req);
  }

  @Get(':releaseId/manifest-summary')
  @RequirePermissions('schedules.read')
  async manifestSummary(@Param('releaseId') releaseId: string, @Req() req: AuthenticatedRequest) {
    await this.ensureReleaseZoneAccess(releaseId, req);
    return this.proxy(`/releases/${encodeURIComponent(releaseId)}/manifest-summary`, req);
  }

  @Delete(':releaseId')
  @RequirePermissions('schedules.write')
  async deleteById(@Param('releaseId') releaseId: string, @Req() req: AuthenticatedRequest) {
    await this.ensureReleaseZoneAccess(releaseId, req);
    return this.proxy(`/releases/${encodeURIComponent(releaseId)}`, req, 'DELETE');
  }
}
