import { Controller, Get, Post, Param, Query, Body, HttpCode, UseGuards, Req, HttpException } from '@nestjs/common';
import { Request } from 'express';
import { DeviceAuthGuard } from '@campuscast/shared-libs';

@Controller('api/v1/player')
@UseGuards(DeviceAuthGuard)
export class PlayerController {
  private readonly scheduleServiceUrl = process.env.SCHEDULE_SERVICE_URL || 'http://localhost:3005';
  private readonly auditServiceUrl = process.env.AUDIT_SERVICE_URL || 'http://audit-service:3009';
  private readonly deviceServiceUrl = process.env.DEVICE_SERVICE_URL || 'http://localhost:3003';

  @Get('device-info')
  async getDeviceInfo(@Query('device_id') deviceId: string, @Req() req: Request) {
    const res = await fetch(
      `${this.deviceServiceUrl}/enrollment/device-info?device_id=${encodeURIComponent(deviceId)}`,
      {
        headers: {
          ...(req.headers['authorization'] ? { authorization: String(req.headers['authorization']) } : {}),
          ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    const payload = await res.json();
    if (!res.ok) throw new HttpException(payload as Record<string, any>, res.status);
    return payload;
  }

  @Get('release')
  async getRelease(@Query('device_id') deviceId: string, @Req() req: Request) {
    const res = await fetch(`${this.scheduleServiceUrl}/releases/latest?device_id=${encodeURIComponent(deviceId)}`, {
      headers: {
        ...(req.headers['authorization'] ? { authorization: String(req.headers['authorization']) } : {}),
        ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });
    const payload = await res.json();
    if (!res.ok) throw new HttpException(payload as Record<string, any>, res.status);
    return payload;
  }

  @Get('manifest/:releaseId')
  async getManifest(@Param('releaseId') releaseId: string, @Req() req: Request) {
    const res = await fetch(`${this.scheduleServiceUrl}/releases/${releaseId}/manifest`, {
      headers: {
        ...(req.headers['authorization'] ? { authorization: String(req.headers['authorization']) } : {}),
        ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
      },
      signal: AbortSignal.timeout(5000),
    });
    const payload = await res.json();
    if (!res.ok) throw new HttpException(payload as Record<string, any>, res.status);
    return payload;
  }

  @Post('telemetry')
  @HttpCode(204)
  async reportTelemetry(@Body() body: {
    device_id: string;
    current_release_id?: string;
    playback_status?: string;
    errors?: string[];
  }, @Req() req: Request) {
    const res = await fetch(`${this.auditServiceUrl}/audit/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers['authorization'] ? { authorization: String(req.headers['authorization']) } : {}),
        ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const payload = await res.json();
      throw new HttpException(payload as Record<string, any>, res.status);
    }
  }

  @Post('preview')
  async uploadPreview(@Body() body: {
    device_id?: string;
    image_base64?: string;
    image_url?: string;
    mime_type?: string;
    captured_at?: string;
    width?: number;
    height?: number;
    status?: string;
  }, @Req() req: Request & { device?: { sub?: string; device_id?: string } }) {
    const deviceId = req.device?.sub || req.device?.device_id || body.device_id;
    if (!deviceId) {
      throw new HttpException({ message: 'device_id is required' }, 400);
    }

    const res = await fetch(`${this.deviceServiceUrl}/devices/${encodeURIComponent(deviceId)}/preview`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers['authorization'] ? { authorization: String(req.headers['authorization']) } : {}),
        ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
      },
      body: JSON.stringify({
        image_base64: body.image_base64,
        image_url: body.image_url,
        mime_type: body.mime_type,
        captured_at: body.captured_at,
        width: body.width,
        height: body.height,
        status: body.status,
      }),
      signal: AbortSignal.timeout(5000),
    });

    const payload = await res.json();
    if (!res.ok) throw new HttpException(payload as Record<string, any>, res.status);
    return payload;
  }
}
