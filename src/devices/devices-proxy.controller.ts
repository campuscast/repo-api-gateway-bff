import { Controller, Post, Get, Put, Param, Body } from '@nestjs/common';

@Controller('api/v1/devices')
export class DevicesProxyController {
  @Post('enroll')
  async enroll(@Body() body: { device_name: string; device_type: string; zone_id: string; group_id: string }) {
    return { device_id: 'stub-device-id', device_token: 'stub.device.token', mqtt_client_id: 'mqtt-stub', mqtt_topic_prefix: `zones/${body.zone_id}/groups/${body.group_id}` };
  }

  @Get(':deviceId')
  async getDevice(@Param('deviceId') deviceId: string) {
    return { device_id: deviceId, status: 'active' };
  }

  @Put(':deviceId/assign')
  async assign(@Param('deviceId') deviceId: string, @Body() body: { group_id: string }) {
    return { device_id: deviceId, group_id: body.group_id, status: 'active' };
  }
}
