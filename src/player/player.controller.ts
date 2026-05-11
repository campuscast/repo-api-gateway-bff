import { Controller, Get, Post, Param, Query, Body, HttpCode, UseGuards, Req, HttpException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { DeviceAuthGuard } from '@campuscast/shared-libs';

@Controller('api/v1/player')
@UseGuards(DeviceAuthGuard)
export class PlayerController {
  private readonly logger = new Logger(PlayerController.name);
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
  @HttpCode(200)
  async reportTelemetry(@Body() body: {
    device_id: string;
    current_release_id?: string | null;
    current_slot_id?: string | null;
    current_publication_id?: string | null;
    current_publication_title?: string | null;
    current_publication_item_id?: string | null;
    current_publication_item_title?: string | null;
    playback_status?: string | null;
    displays?: unknown;
    selected_displays?: unknown;
    timestamp?: string | null;
    online?: boolean | null;
    backend_status?: string | null;
    mqtt_status?: string | null;
    last_error?: string | null;
    errors?: string[];
  }, @Req() req: Request & { device?: { sub?: string; device_id?: string } }) {
    const deviceId = req.device?.sub || req.device?.device_id || body.device_id;
    if (!deviceId) {
      throw new HttpException({ message: 'device_id is required' }, 400);
    }

    const runtimeRes = await fetch(`${this.deviceServiceUrl}/devices/${encodeURIComponent(deviceId)}/runtime`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers['authorization'] ? { authorization: String(req.headers['authorization']) } : {}),
        ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
      },
      body: JSON.stringify({
        ...body,
        device_id: deviceId,
      }),
      signal: AbortSignal.timeout(5000),
    });
    const runtimePayload = await runtimeRes.json();
    if (!runtimeRes.ok) {
      throw new HttpException(runtimePayload as Record<string, any>, runtimeRes.status);
    }

    void fetch(`${this.auditServiceUrl}/audit/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers['authorization'] ? { authorization: String(req.headers['authorization']) } : {}),
        ...(req.headers['x-correlation-id'] ? { 'x-correlation-id': String(req.headers['x-correlation-id']) } : {}),
      },
      body: JSON.stringify({
        ...body,
        device_id: deviceId,
      }),
      signal: AbortSignal.timeout(5000),
    }).then(async (res) => {
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        this.logger.warn(`Telemetry audit append failed for device=${deviceId} status=${res.status} payload=${JSON.stringify(payload)}`);
      }
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Telemetry audit append crashed for device=${deviceId} reason=${message}`);
    });

    return runtimePayload;
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
    display_id?: string;
    display_label?: string;
    request_id?: string;
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
        display_id: body.display_id,
        display_label: body.display_label,
        request_id: body.request_id,
      }),
      signal: AbortSignal.timeout(5000),
    });

    const payload = await res.json();
    if (!res.ok) throw new HttpException(payload as Record<string, any>, res.status);
    return payload;
  }
}
