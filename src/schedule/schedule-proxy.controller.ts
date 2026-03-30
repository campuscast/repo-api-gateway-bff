import { Controller, Post, Get, Delete, Param, Body, Query, UseGuards, Req, HttpException, HttpCode, BadGatewayException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ZoneScopeGuard, PermissionsGuard, RequirePermissions } from '@campuscast/shared-libs';
import { assertZoneAccess, type ZoneAwareUser } from '../common/zone-access';
import { buildCanonicalScheduleOpPayload } from './op-signature';

type AuthenticatedRequest = Request & {
  user?: ZoneAwareUser & { sub?: string; user_id?: string };
};

@Controller('api/v1/schedules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScheduleProxyController {
  private readonly scheduleServiceUrl = process.env.SCHEDULE_SERVICE_URL || 'http://localhost:3005';
  private readonly syncServiceUrl = process.env.SYNC_SERVICE_URL || 'http://localhost:3006';
  private readonly signingKmsUrl = process.env.SIGNING_KMS_URL || 'http://localhost:3008';

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

  private async getScheduleZoneId(scheduleId: string, req: Request): Promise<string> {
    const schedule = await this.proxy(`/schedules/${encodeURIComponent(scheduleId)}`, req, 'GET') as { zone_id?: string };
    const zoneId = typeof schedule?.zone_id === 'string' ? schedule.zone_id : '';
    if (!zoneId) {
      throw new HttpException({ message: 'Schedule zone not found' }, 500);
    }
    return zoneId;
  }

  private async ensureScheduleZoneAccess(scheduleId: string, req: AuthenticatedRequest): Promise<void> {
    const zoneId = await this.getScheduleZoneId(scheduleId, req);
    assertZoneAccess(req.user, zoneId, `schedule:${scheduleId}`);
  }

  private getEditorUserId(req: AuthenticatedRequest): string {
    return req.user?.sub || req.user?.user_id || '';
  }

  private sanitizeScheduleLockToken<T extends Record<string, unknown>>(schedule: T, userId: string): T {
    const lockedBy = typeof schedule?.locked_by === 'string' ? schedule.locked_by : '';
    const lockToken = typeof schedule?.lock_token === 'string' ? schedule.lock_token : '';
    if (!lockToken) return schedule;
    if (!userId || (lockedBy && lockedBy !== userId)) {
      return {
        ...schedule,
        lock_token: '',
      };
    }
    return schedule;
  }

  @Post()
  @RequirePermissions('schedules.write')
  @UseGuards(ZoneScopeGuard)
  async create(@Body() body: { zone_id: string; name: string }, @Req() req: AuthenticatedRequest) {
    return this.proxy('/schedules', req, 'POST', body);
  }

  @Get()
  @RequirePermissions('schedules.read')
  @UseGuards(ZoneScopeGuard)
  async list(
    @Query('zone_id') zoneId: string,
    @Query('group_id') groupId: string | undefined,
    @Query('page') page = 1,
    @Query('page_size') pageSize = 20,
    @Req() req: AuthenticatedRequest,
  ): Promise<Record<string, unknown>> {
    const params = new URLSearchParams({
      zone_id: zoneId,
      page: String(page),
      page_size: String(pageSize),
    });
    if (groupId) params.set('group_id', groupId);
    const payload = await this.proxy(`/schedules?${params.toString()}`, req, 'GET') as {
      data?: Array<Record<string, unknown>>;
      pagination?: Record<string, unknown>;
    };
    const userId = this.getEditorUserId(req);
    return {
      data: Array.isArray(payload.data)
        ? payload.data.map((item) => this.sanitizeScheduleLockToken(item, userId))
        : [],
      pagination: payload.pagination || {},
    };
  }

  @Get('usage')
  @RequirePermissions('schedules.read')
  @UseGuards(ZoneScopeGuard)
  async usage(@Query('zone_id') zoneId: string, @Req() req: AuthenticatedRequest) {
    return this.proxy(`/schedules/usage?zone_id=${encodeURIComponent(zoneId)}`, req, 'GET');
  }

  @Get(':scheduleId')
  @RequirePermissions('schedules.read')
  async getById(@Param('scheduleId') scheduleId: string, @Req() req: AuthenticatedRequest) {
    await this.ensureScheduleZoneAccess(scheduleId, req);
    const payload = await this.proxy(`/schedules/${scheduleId}`, req, 'GET') as Record<string, unknown>;
    return this.sanitizeScheduleLockToken(payload, this.getEditorUserId(req));
  }

  @Delete(':scheduleId')
  @RequirePermissions('schedules.write')
  async deleteById(@Param('scheduleId') scheduleId: string, @Req() req: AuthenticatedRequest) {
    await this.ensureScheduleZoneAccess(scheduleId, req);
    return this.proxy(`/schedules/${scheduleId}`, req, 'DELETE');
  }

  @Get(':scheduleId/calendar')
  @RequirePermissions('schedules.read')
  async getCalendar(
    @Param('scheduleId') scheduleId: string,
    @Query('view') view = 'month',
    @Query('date') date: string | undefined,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.ensureScheduleZoneAccess(scheduleId, req);
    const params = new URLSearchParams({ view });
    if (date) params.set('date', date);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return this.proxy(`/schedules/${scheduleId}/calendar?${params.toString()}`, req, 'GET');
  }

  @Get(':scheduleId/day')
  @RequirePermissions('schedules.read')
  async getDay(
    @Param('scheduleId') scheduleId: string,
    @Query('date') date: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.ensureScheduleZoneAccess(scheduleId, req);
    return this.proxy(`/schedules/${scheduleId}/day?date=${encodeURIComponent(date)}`, req, 'GET');
  }

  @Post(':scheduleId/lock')
  @RequirePermissions('schedules.write')
  async acquireLock(@Param('scheduleId') scheduleId: string, @Body() body: { ttl_seconds?: number }, @Req() req: AuthenticatedRequest) {
    await this.ensureScheduleZoneAccess(scheduleId, req);
    return this.proxy(`/schedules/${scheduleId}/lock`, req, 'POST', {
      user_id: req.user?.sub || req.user?.user_id || 'unknown',
      ttl_seconds: body.ttl_seconds,
    });
  }

  @Delete(':scheduleId/lock')
  @RequirePermissions('schedules.write')
  async releaseLock(@Param('scheduleId') scheduleId: string, @Body() body: { lock_token: string }, @Req() req: AuthenticatedRequest) {
    await this.ensureScheduleZoneAccess(scheduleId, req);
    return this.proxy(`/schedules/${scheduleId}/lock`, req, 'DELETE', body);
  }

  @Post(':scheduleId/lock/refresh')
  @RequirePermissions('schedules.write')
  async refreshLock(
    @Param('scheduleId') scheduleId: string,
    @Body() body: { lock_token: string; ttl_seconds?: number },
    @Req() req: AuthenticatedRequest,
  ) {
    await this.ensureScheduleZoneAccess(scheduleId, req);
    return this.proxy(`/schedules/${scheduleId}/lock/refresh`, req, 'POST', body);
  }

  @Post(':id/save')
  @HttpCode(200)
  @RequirePermissions('schedules.write')
  async saveDraft(@Param('id') id: string, @Body() body: { slots: any[]; lock_token: string }, @Req() req: AuthenticatedRequest) {
    await this.ensureScheduleZoneAccess(id, req);
    return this.proxy(`/schedules/${id}/save`, req, 'POST', body);
  }

  @Post(':scheduleId/day')
  @RequirePermissions('schedules.write')
  async saveDay(
    @Param('scheduleId') scheduleId: string,
    @Body() body: { date: string; slots: any[]; lock_token?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    await this.ensureScheduleZoneAccess(scheduleId, req);
    return this.proxy(`/schedules/${scheduleId}/day`, req, 'POST', body);
  }

  @Post(':scheduleId/ops')
  @HttpCode(200)
  @RequirePermissions('schedules.write')
  async ingestOps(@Param('scheduleId') scheduleId: string, @Body() body: { ops: any[] }, @Req() req: AuthenticatedRequest) {
    await this.ensureScheduleZoneAccess(scheduleId, req);
    return this.proxy(`/schedules/${scheduleId}/ops`, req, 'POST', body, this.syncServiceUrl);
  }

  @Post(':scheduleId/ops/sign')
  @HttpCode(200)
  @RequirePermissions('schedules.write')
  async signOps(@Param('scheduleId') scheduleId: string, @Body() body: { ops: any[] }, @Req() req: AuthenticatedRequest) {
    await this.ensureScheduleZoneAccess(scheduleId, req);

    const userId = req.user?.sub || req.user?.user_id;
    if (!userId) {
      throw new HttpException({ message: 'Authenticated editor user is required for op signing' }, 401);
    }
    if (!Array.isArray(body?.ops) || body.ops.length === 0) {
      throw new HttpException({ message: 'ops must be a non-empty array' }, 400);
    }

    const defaultSessionId = `editor-session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const signedOps = await Promise.all(
      body.ops.map(async (rawOp) => {
        const sessionId =
          rawOp?.actor?.session_id ||
          rawOp?.causal?.session_id ||
          defaultSessionId;

        const opWithActor = {
          ...rawOp,
          causal: {
            ...(rawOp?.causal || {}),
            client_id: rawOp?.causal?.client_id || `editor:${userId}`,
            session_id: sessionId,
          },
          actor: {
            ...(rawOp?.actor || {}),
            auth_type: 'user_session',
            user_id: userId,
            session_id: sessionId,
          },
        };

        const canonicalPayload = buildCanonicalScheduleOpPayload(opWithActor);
        const signRes = await fetch(`${this.signingKmsUrl}/signing/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data_base64: Buffer.from(canonicalPayload, 'utf8').toString('base64'),
            purpose: 'operation',
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (!signRes.ok) {
          const errorText = await signRes.text();
          throw new BadGatewayException(`signing-kms sign failed: ${errorText}`);
        }

        const signed = await signRes.json() as {
          signature?: string;
          key_id?: string;
          algorithm?: string;
        };

        if (!signed.signature || !signed.key_id) {
          throw new BadGatewayException('signing-kms returned incomplete signature payload');
        }

        return {
          ...opWithActor,
          signature: {
            signature: signed.signature,
            key_id: signed.key_id,
            algorithm: signed.algorithm || 'Ed25519',
          },
        };
      }),
    );

    return { ops: signedOps };
  }

  @Post(':scheduleId/publish')
  @RequirePermissions('schedules.publish')
  async publish(@Param('scheduleId') scheduleId: string, @Body() body: { version_number: number; target_group_ids?: string[] }, @Req() req: AuthenticatedRequest) {
    await this.ensureScheduleZoneAccess(scheduleId, req);
    return this.proxy(`/schedules/${scheduleId}/publish`, req, 'POST', body);
  }

  @Post(':scheduleId/validate')
  @RequirePermissions('schedules.write')
  async validate(@Param('scheduleId') scheduleId: string, @Req() req: AuthenticatedRequest) {
    await this.ensureScheduleZoneAccess(scheduleId, req);
    return this.proxy(`/schedules/${scheduleId}/validate`, req, 'POST');
  }
}
