import { Controller, Post, Get, Delete, Param, Body, Query } from '@nestjs/common';

@Controller('api/v1/schedules')
export class ScheduleProxyController {
  @Post()
  async create(@Body() body: { zone_id: string; name: string }) {
    return { schedule_id: 'stub-sched-id', zone_id: body.zone_id, name: body.name, status: 'draft', current_version: 0 };
  }

  @Get()
  async list(@Query('zone_id') zoneId: string) {
    return { data: [], pagination: { total: 0, page: 1, page_size: 20 } };
  }

  @Post(':scheduleId/lock')
  async acquireLock(@Param('scheduleId') scheduleId: string, @Body() body: { ttl_seconds?: number }) {
    return { acquired: true, lock_token: 'stub-lock-token', locked_by: 'user-1', expires_at: new Date(Date.now() + (body.ttl_seconds || 300) * 1000).toISOString() };
  }

  @Delete(':scheduleId/lock')
  async releaseLock(@Param('scheduleId') scheduleId: string, @Body() body: { lock_token: string }) {
    return { released: true };
  }

  @Post(':scheduleId/ops')
  async ingestOps(@Param('scheduleId') scheduleId: string, @Body() body: { ops: any[] }) {
    return { accepted: body.ops.length, rejected: 0, results: [] };
  }

  @Post(':scheduleId/publish')
  async publish(@Param('scheduleId') scheduleId: string, @Body() body: { version_number: number }) {
    return { release_id: 'stub-release-id', validation_passed: true, issues: [] };
  }

  @Post(':scheduleId/validate')
  async validate(@Param('scheduleId') scheduleId: string) {
    return { valid: true, has_fatal: false, issues: [] };
  }
}
