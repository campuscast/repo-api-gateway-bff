import { Controller, Post, Get, Delete, Patch, Param, Body, Query, UseGuards, Req, HttpException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ZoneScopeGuard, PermissionsGuard, RequirePermissions } from '@campuscast/shared-libs';
import { assertZoneAccess, type ZoneAwareUser } from '../common/zone-access';

@Controller('api/v1/content')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContentProxyController {
  private readonly contentServiceUrl = process.env.CONTENT_SERVICE_URL || 'http://localhost:3004';

  private async getAssetZoneId(assetId: string, req: Request): Promise<string> {
    const asset = await this.proxy(`/content/asset/${encodeURIComponent(assetId)}`, req, 'GET') as { zone_id?: string };
    const zoneId = typeof asset?.zone_id === 'string' ? asset.zone_id : '';
    if (!zoneId) {
      throw new HttpException({ message: 'Asset zone not found' }, 500);
    }
    return zoneId;
  }

  private async ensureAssetZoneAccess(assetId: string, req: Request & { user?: ZoneAwareUser }): Promise<void> {
    const zoneId = await this.getAssetZoneId(assetId, req);
    assertZoneAccess(req.user, zoneId, `asset:${assetId}`);
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

  @Patch(':assetId')
  @RequirePermissions('content.write')
  async renameAsset(@Param('assetId') assetId: string, @Body() body: { filename: string }, @Req() req: Request) {
    await this.ensureAssetZoneAccess(assetId, req as Request & { user?: ZoneAwareUser });
    return this.proxy(`/content/${assetId}`, req, 'PATCH', body as unknown as Record<string, unknown>);
  }

  @Delete(':assetId')
  @RequirePermissions('content.write')
  async deleteAsset(@Param('assetId') assetId: string, @Req() req: Request) {
    await this.ensureAssetZoneAccess(assetId, req as Request & { user?: ZoneAwareUser });
    return this.proxy(`/content/${assetId}`, req, 'DELETE');
  }

  @Get()
  @RequirePermissions('content.read')
  @UseGuards(ZoneScopeGuard)
  async listAssets(@Query('zone_id') zoneId: string, @Query('page') page = 1, @Query('page_size') pageSize = 20, @Req() req: Request) {
    return this.proxy(`/content?zone_id=${encodeURIComponent(zoneId)}&page=${page}&page_size=${pageSize}`, req, 'GET');
  }
}
