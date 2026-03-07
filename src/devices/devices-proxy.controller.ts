import { Controller, Post, Get, Put, Param, Body, UseGuards, Req, HttpException } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, ZoneScopeGuard } from '@campuscast/shared-libs';

@Controller('api/v1/devices')
@UseGuards(JwtAuthGuard)
export class DevicesProxyController {
  private readonly deviceServiceUrl = process.env.DEVICE_SERVICE_URL || 'http://localhost:3003';

  private async proxy(
    path: string,
    req: Request,
    method: 'GET' | 'POST' | 'PUT',
    body?: Record<string, unknown>,
  ) {
    const res = await fetch(`${this.deviceServiceUrl}${path}`, {
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

  @Post('register')
  @UseGuards(ZoneScopeGuard)
  async register(@Body() body: { device_name: string; device_type: string; hardware_id?: string; zone_id: string; group_id: string }, @Req() req: Request) {
    return this.proxy('/devices/register', req, 'POST', body);
  }

  @Post('enroll')
  @UseGuards(ZoneScopeGuard)
  async enroll(@Body() body: { device_name: string; device_type: string; hardware_id?: string; zone_id: string; group_id: string }, @Req() req: Request) {
    return this.proxy('/devices/register', req, 'POST', body);
  }

  @Get(':deviceId')
  async getDevice(@Param('deviceId') deviceId: string, @Req() req: Request) {
    return this.proxy(`/devices/${deviceId}`, req, 'GET');
  }

  @Put(':deviceId/assign')
  async assign(@Param('deviceId') deviceId: string, @Body() body: { group_id: string }, @Req() req: Request) {
    return this.proxy(`/devices/${deviceId}/assign`, req, 'PUT', body);
  }
}
