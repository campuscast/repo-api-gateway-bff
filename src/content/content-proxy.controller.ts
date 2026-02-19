import { Controller, Post, Get, Param, Body, Query } from '@nestjs/common';

@Controller('api/v1/content')
export class ContentProxyController {
  @Post('init-upload')
  async initUpload(@Body() body: { zone_id: string; filename: string; content_type: string; file_size: number }) {
    return { asset_id: 'stub-asset-id', upload_url: 'http://minio:9000/stub-presigned-url', expires_at: new Date(Date.now() + 3600_000).toISOString() };
  }

  @Post(':assetId/complete')
  async completeUpload(@Param('assetId') assetId: string, @Body() body: { sha256_hash: string }) {
    return { asset_id: assetId, status: 'ready', sha256_hash: body.sha256_hash, signature: 'stub-sig', key_id: 'key-1' };
  }

  @Get()
  async listAssets(@Query('zone_id') zoneId: string, @Query('page') page = 1, @Query('page_size') pageSize = 20) {
    return { data: [], pagination: { total: 0, page, page_size: pageSize } };
  }
}
