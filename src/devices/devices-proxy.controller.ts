import { Controller, Post, Get, Put, Patch, Delete, Param, Query, Body, UseGuards, Req, HttpException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ZoneScopeGuard, PermissionsGuard, RequirePermissions } from '@campuscast/shared-libs';
import { assertZoneAccess, type ZoneAwareUser } from '../common/zone-access';

type AuthenticatedRequest = Request & {
  user?: ZoneAwareUser;
};

@Controller('api/v1/devices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DevicesProxyController {
  private readonly deviceServiceUrl = process.env.DEVICE_SERVICE_URL || 'http://localhost:3003';

  private async proxy(
    path: string,
    req: Request,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: Record<string, unknown>,
  ) {
    const res = await fetch(`${this.deviceServiceUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(req.headers['authorization'] ? { authorization: String(req.headers['authorization']) } : {}),
        ...(req.headers['cookie'] ? { cookie: String(req.headers['cookie']) } : {}),
        ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(5000),
    });
    const payload = await res.json();
    if (!res.ok) throw new HttpException(payload as Record<string, any>, res.status);
    return payload;
  }

  private async getDeviceZoneId(deviceId: string, req: Request): Promise<string> {
    const device = await this.proxy(`/devices/${encodeURIComponent(deviceId)}`, req, 'GET') as { zone_id?: string };
    const zoneId = typeof device?.zone_id === 'string' ? device.zone_id : '';
    if (!zoneId) {
      throw new HttpException({ message: 'Device zone not found' }, 500);
    }
    return zoneId;
  }

  private async ensureDeviceZoneAccess(deviceId: string, req: AuthenticatedRequest): Promise<void> {
    const zoneId = await this.getDeviceZoneId(deviceId, req);
    assertZoneAccess(req.user, zoneId, `device:${deviceId}`);
  }

  @Get()
  @RequirePermissions('devices.read')
  @UseGuards(ZoneScopeGuard)
  async list(@Query('zone_id') zoneId: string, @Req() req: AuthenticatedRequest) {
    return this.proxy(`/devices?zone_id=${encodeURIComponent(zoneId ?? '')}`, req, 'GET');
  }

  @Post('register')
  @RequirePermissions('devices.write')
  @UseGuards(ZoneScopeGuard)
  async register(@Body() body: { device_name: string; device_type: string; hardware_id?: string; zone_id: string; group_id?: string }, @Req() req: AuthenticatedRequest) {
    return this.proxy('/devices/register', req, 'POST', body);
  }

  @Post('enroll')
  @RequirePermissions('devices.write')
  @UseGuards(ZoneScopeGuard)
  async enroll(@Body() body: { device_name: string; device_type: string; hardware_id?: string; zone_id: string; group_id?: string }, @Req() req: AuthenticatedRequest) {
    return this.proxy('/devices/register', req, 'POST', body);
  }

  @Get(':deviceId')
  @RequirePermissions('devices.read')
  async getDevice(@Param('deviceId') deviceId: string, @Req() req: AuthenticatedRequest) {
    await this.ensureDeviceZoneAccess(deviceId, req);
    return this.proxy(`/devices/${deviceId}`, req, 'GET');
  }

  @Get(':deviceId/runtime')
  @RequirePermissions('devices.read')
  async getRuntime(@Param('deviceId') deviceId: string, @Req() req: AuthenticatedRequest) {
    await this.ensureDeviceZoneAccess(deviceId, req);
    return this.proxy(`/devices/${deviceId}/runtime`, req, 'GET');
  }

  @Get(':deviceId/preview')
  @RequirePermissions('devices.read')
  async getPreview(@Param('deviceId') deviceId: string, @Req() req: AuthenticatedRequest) {
    await this.ensureDeviceZoneAccess(deviceId, req);
    return this.proxy(`/devices/${deviceId}/preview`, req, 'GET');
  }

  @Post(':deviceId/preview-request')
  @RequirePermissions('devices.write')
  async requestPreview(@Param('deviceId') deviceId: string, @Body() body: { display_id?: string | null }, @Req() req: AuthenticatedRequest) {
    await this.ensureDeviceZoneAccess(deviceId, req);
    return this.proxy(`/devices/${deviceId}/preview-request`, req, 'POST', body);
  }

  @Patch(':deviceId')
  @RequirePermissions('devices.write')
  async update(@Param('deviceId') deviceId: string, @Body() body: Record<string, unknown>, @Req() req: AuthenticatedRequest) {
    await this.ensureDeviceZoneAccess(deviceId, req);
    return this.proxy(`/devices/${deviceId}`, req, 'PATCH', body);
  }

  @Delete(':deviceId')
  @RequirePermissions('devices.write')
  async remove(@Param('deviceId') deviceId: string, @Req() req: AuthenticatedRequest) {
    await this.ensureDeviceZoneAccess(deviceId, req);
    return this.proxy(`/devices/${deviceId}`, req, 'DELETE');
  }

  @Put(':deviceId/assign')
  @RequirePermissions('devices.write')
  async assign(@Param('deviceId') deviceId: string, @Body() body: { group_id?: string }, @Req() req: AuthenticatedRequest) {
    await this.ensureDeviceZoneAccess(deviceId, req);
    return this.proxy(`/devices/${deviceId}/assign`, req, 'PUT', body);
  }
}
