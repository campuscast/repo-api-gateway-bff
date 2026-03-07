import { Controller, Post, Get, Delete, Patch, Param, Body, Query, UseGuards, Req, HttpException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ZoneScopeGuard } from '@campuscast/shared-libs';

@Controller('api/v1/content')
@UseGuards(JwtAuthGuard)
export class ContentProxyController {
  private readonly contentServiceUrl = process.env.CONTENT_SERVICE_URL || 'http://localhost:3004';

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
  @UseGuards(ZoneScopeGuard)
  async initUpload(@Body() body: { zone_id: string; filename: string; content_type: string; file_size: number }, @Req() req: Request) {
    return this.proxy('/content/init-upload', req, 'POST', body);
  }

  @Post(':assetId/complete')
  async completeUpload(@Param('assetId') assetId: string, @Body() body: { sha256_hash: string }, @Req() req: Request) {
    return this.proxy(`/content/${assetId}/complete`, req, 'POST', body);
  }

  @Patch(':assetId')
  async renameAsset(@Param('assetId') assetId: string, @Body() body: { filename: string }, @Req() req: Request) {
    return this.proxy(`/content/${assetId}`, req, 'PATCH', body as unknown as Record<string, unknown>);
  }

  @Delete(':assetId')
  async deleteAsset(@Param('assetId') assetId: string, @Req() req: Request) {
    return this.proxy(`/content/${assetId}`, req, 'DELETE');
  }

  @Get()
  @UseGuards(ZoneScopeGuard)
  async listAssets(@Query('zone_id') zoneId: string, @Query('page') page = 1, @Query('page_size') pageSize = 20, @Req() req: Request) {
    return this.proxy(`/content?zone_id=${encodeURIComponent(zoneId)}&page=${page}&page_size=${pageSize}`, req, 'GET');
  }
}
