import { Controller, Post, Get, Delete, Param, Body, Query, UseGuards, Req, HttpException, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ZoneScopeGuard } from '@campuscast/shared-libs';

@Controller('api/v1/schedules')
@UseGuards(JwtAuthGuard)
export class ScheduleProxyController {
  private readonly scheduleServiceUrl = process.env.SCHEDULE_SERVICE_URL || 'http://localhost:3005';
  private readonly syncServiceUrl = process.env.SYNC_SERVICE_URL || 'http://localhost:3006';

  private async proxy(
    path: string,
    req: Request,
    method: 'GET' | 'POST' | 'DELETE',
    body?: Record<string, unknown>,
    targetBaseUrl = this.scheduleServiceUrl,
  ) {
    const res = await fetch(`${targetBaseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(req.headers['authorization'] ? { authorization: String(req.headers['authorization']) } : {}),
        ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(7000),
    });
    const payload = await res.json();
    if (!res.ok) throw new HttpException(payload as Record<string, any>, res.status);
    return payload;
  }

  @Post()
  @UseGuards(ZoneScopeGuard)
  async create(@Body() body: { zone_id: string; name: string }, @Req() req: Request) {
    return this.proxy('/schedules', req, 'POST', body);
  }

  @Get()
  @UseGuards(ZoneScopeGuard)
  async list(@Query('zone_id') zoneId: string, @Query('page') page = 1, @Query('page_size') pageSize = 20, @Req() req: Request) {
    return this.proxy(`/schedules?zone_id=${encodeURIComponent(zoneId)}&page=${page}&page_size=${pageSize}`, req, 'GET');
  }

  @Post(':scheduleId/lock')
  async acquireLock(@Param('scheduleId') scheduleId: string, @Body() body: { ttl_seconds?: number }, @Req() req: Request & { user?: { sub?: string; user_id?: string } }) {
    return this.proxy(`/schedules/${scheduleId}/lock`, req, 'POST', {
      user_id: req.user?.sub || req.user?.user_id || 'unknown',
      ttl_seconds: body.ttl_seconds,
    });
  }

  @Delete(':scheduleId/lock')
  async releaseLock(@Param('scheduleId') scheduleId: string, @Body() body: { lock_token: string }, @Req() req: Request) {
    return this.proxy(`/schedules/${scheduleId}/lock`, req, 'DELETE', body);
  }

  @Post(':id/save')
  @HttpCode(200)
  async saveDraft(@Param('id') id: string, @Body() body: { slots: any[]; lock_token: string }, @Req() req: Request) {
    return this.proxy(`/schedules/${id}/save`, req, 'POST', body);
  }

  @Post(':scheduleId/ops')
  @HttpCode(200)
  async ingestOps(@Param('scheduleId') scheduleId: string, @Body() body: { ops: any[] }, @Req() req: Request) {
    return this.proxy(`/schedules/${scheduleId}/ops`, req, 'POST', body, this.syncServiceUrl);
  }

  @Post(':scheduleId/publish')
  async publish(@Param('scheduleId') scheduleId: string, @Body() body: { version_number: number; target_group_ids?: string[] }, @Req() req: Request) {
    return this.proxy(`/schedules/${scheduleId}/publish`, req, 'POST', body);
  }

  @Post(':scheduleId/validate')
  async validate(@Param('scheduleId') scheduleId: string, @Req() req: Request) {
    return this.proxy(`/schedules/${scheduleId}/validate`, req, 'POST');
  }
}
