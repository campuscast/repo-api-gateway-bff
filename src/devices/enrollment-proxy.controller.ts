import {
  BadGatewayException,
  Controller,
  GatewayTimeoutException,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
  HttpException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from '@campuscast/shared-libs';

@Controller('api/v1/enrollment')
export class EnrollmentProxyController {
  private readonly deviceServiceUrl = process.env.DEVICE_SERVICE_URL || 'http://localhost:3003';

  private async proxy(
    path: string,
    req: Request,
    method: 'GET' | 'POST',
    body?: Record<string, unknown>,
  ) {
    let res: Response;
    try {
      res = await fetch(`${this.deviceServiceUrl}${path}`, {
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
    } catch (error) {
      const err = error as { name?: string };
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new GatewayTimeoutException('Device service request timed out');
      }
      throw new BadGatewayException('Device service is unavailable');
    }

    const raw = await res.text();
    let payload: unknown = {
      statusCode: res.status,
      message: res.statusText || 'Upstream response body was empty',
    };
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = { statusCode: res.status, message: raw };
      }
    }

    if (!res.ok) throw new HttpException(payload as Record<string, any>, res.status);
    return payload;
  }

  /** Create pending device — requires CMS auth */
  @Post('create')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('devices.write')
  async createPending(@Body() body: { device_name: string; device_type: string; hardware_id?: string; zone_id: string; group_id: string }, @Req() req: Request) {
    return this.proxy('/enrollment/create', req, 'POST', body);
  }

  /** Device requests activation code — unauthenticated */
  @Post('request-code')
  async requestCode(@Body() body: { device_id: string }, @Req() req: Request) {
    return this.proxy('/enrollment/request-code', req, 'POST', body);
  }

  /** CMS activates device by code — requires CMS auth */
  @Post('activate-by-code')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('devices.write')
  async activateByCode(@Body() body: { device_id: string; activation_code: string }, @Req() req: Request) {
    return this.proxy('/enrollment/activate-by-code', req, 'POST', body);
  }

  /** CMS activates device by MAC — requires CMS auth */
  @Post('activate-by-mac')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('devices.write')
  async activateByMac(@Body() body: { device_id: string; hardware_id: string }, @Req() req: Request) {
    return this.proxy('/enrollment/activate-by-mac', req, 'POST', body);
  }

  /** Device polls for credentials after activation — unauthenticated */
  @Get('credentials')
  async getCredentials(@Query('device_id') deviceId: string, @Query('code') code: string, @Req() req: Request) {
    return this.proxy(`/enrollment/credentials?device_id=${encodeURIComponent(deviceId)}&code=${encodeURIComponent(code)}`, req, 'GET');
  }
}
