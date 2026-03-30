import { Controller, Post, Get, Delete, Patch, Param, Body, Query, UseGuards, Req, HttpException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ZoneScopeGuard, PermissionsGuard, RequirePermissions } from '@campuscast/shared-libs';
import { assertAnyZoneAccess, assertZoneAccess, type ZoneAwareUser } from '../common/zone-access';

@Controller('api/v1/content')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContentProxyController {
  private readonly contentServiceUrl = process.env.CONTENT_SERVICE_URL || 'http://localhost:3004';

  private async getAssetZoneIds(assetId: string, req: Request): Promise<string[]> {
    const asset = await this.proxy(`/content/asset/${encodeURIComponent(assetId)}`, req, 'GET') as {
      zone_ids?: string[];
      zone_id?: string;
    };
    const zoneIds = Array.isArray(asset?.zone_ids)
      ? asset.zone_ids.map((zoneId) => String(zoneId || '').trim()).filter(Boolean)
      : typeof asset?.zone_id === 'string' && asset.zone_id
        ? [asset.zone_id]
        : [];
    if (zoneIds.length === 0) {
      throw new HttpException({ message: 'Asset zones not found' }, 500);
    }
    return zoneIds;
  }

  private async ensureAssetZoneAccess(
    assetId: string,
    req: Request & { user?: ZoneAwareUser },
    mode: 'any' | 'all' = 'any',
  ): Promise<void> {
    const zoneIds = await this.getAssetZoneIds(assetId, req);
    if (mode === 'all') {
      for (const zoneId of zoneIds) {
        assertZoneAccess(req.user, zoneId, `asset:${assetId}`);
      }
      return;
    }
    assertAnyZoneAccess(req.user, zoneIds, `asset:${assetId}`);
  }

  private async proxy(
    path: string,
    req: Request,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    body?: Record<string, unknown>,
  ) {
    const res = await fetch(`${this.contentServiceUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(req.headers['authorization'] ? { authorization: String(req.headers['authorization']) } : {}),
        ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(5000),
    });
    const payload = await res.json();
    if (!res.ok) throw new HttpException(payload as Record<string, any>, res.status);
    return payload;
  }

  @Post('init-upload')
  @RequirePermissions('content.write')
  @UseGuards(ZoneScopeGuard)
  async initUpload(@Body() body: { zone_id: string; filename: string; content_type: string; file_size: number }, @Req() req: Request) {
    return this.proxy('/content/init-upload', req, 'POST', body);
  }

  @Post(':assetId/complete')
  @RequirePermissions('content.write')
  async completeUpload(@Param('assetId') assetId: string, @Body() body: { sha256_hash: string }, @Req() req: Request) {
    await this.ensureAssetZoneAccess(assetId, req as Request & { user?: ZoneAwareUser });
    return this.proxy(`/content/${assetId}/complete`, req, 'POST', body);
  }

  @Get('asset/:assetId')
  @RequirePermissions('content.read')
  async getAsset(@Param('assetId') assetId: string, @Req() req: Request & { user?: ZoneAwareUser }) {
    await this.ensureAssetZoneAccess(assetId, req);
    return this.proxy(`/content/asset/${assetId}`, req, 'GET');
  }

  @Get('asset/:assetId/info')
  @RequirePermissions('content.read')
  async getAssetInfo(@Param('assetId') assetId: string, @Req() req: Request & { user?: ZoneAwareUser }) {
    await this.ensureAssetZoneAccess(assetId, req);
    return this.proxy(`/content/asset/${assetId}/info`, req, 'GET');
  }

  @Patch(':assetId')
  @RequirePermissions('content.write')
  async renameAsset(@Param('assetId') assetId: string, @Body() body: { filename: string }, @Req() req: Request) {
    await this.ensureAssetZoneAccess(assetId, req as Request & { user?: ZoneAwareUser }, 'all');
    return this.proxy(`/content/${assetId}`, req, 'PATCH', body as unknown as Record<string, unknown>);
  }

  @Patch(':assetId/availability')
  @RequirePermissions('content.write')
  async updateAvailability(
    @Param('assetId') assetId: string,
    @Body() body: { zone_ids: string[] },
    @Req() req: Request & { user?: ZoneAwareUser },
  ) {
    await this.ensureAssetZoneAccess(assetId, req, 'all');
    for (const zoneId of body.zone_ids || []) {
      assertZoneAccess(req.user, zoneId, `asset:${assetId}:availability`);
    }
    return this.proxy(`/content/${assetId}/availability`, req, 'PATCH', body as Record<string, unknown>);
  }

  @Post(':assetId/availability/prune-unused')
  @RequirePermissions('content.write')
  async pruneUnusedAvailability(@Param('assetId') assetId: string, @Req() req: Request & { user?: ZoneAwareUser }) {
    await this.ensureAssetZoneAccess(assetId, req, 'all');
    return this.proxy(`/content/${assetId}/availability/prune-unused`, req, 'POST');
  }

  @Delete(':assetId')
  @RequirePermissions('content.write')
  async deleteAsset(@Param('assetId') assetId: string, @Req() req: Request) {
    await this.ensureAssetZoneAccess(assetId, req as Request & { user?: ZoneAwareUser }, 'all');
    return this.proxy(`/content/${assetId}`, req, 'DELETE');
  }

  @Get()
  @RequirePermissions('content.read')
  @UseGuards(ZoneScopeGuard)
  async listAssets(
    @Query('zone_id') zoneId: string,
    @Query('zone_ids') zoneIdsQuery: string,
    @Query('page') page = 1,
    @Query('page_size') pageSize = 20,
    @Req() req: Request,
  ) {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (zoneIdsQuery) {
      params.set('zone_ids', zoneIdsQuery);
    } else if (zoneId) {
      params.set('zone_id', zoneId);
    }
    return this.proxy(`/content?${params.toString()}`, req, 'GET');
  }
}
