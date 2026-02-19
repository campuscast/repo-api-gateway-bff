import { Controller, Get, Post, Param, Query, Body, HttpCode } from '@nestjs/common';

@Controller('api/v1/player')
export class PlayerController {
  @Get('release')
  async getRelease(@Query('device_id') deviceId: string) {
    return { release_id: 'stub-release', schedule_id: 'stub-sched', version_number: 1, status: 'active' };
  }

  @Get('manifest/:releaseId')
  async getManifest(@Param('releaseId') releaseId: string) {
    return { release_id: releaseId, files: [], slots: [], signature: 'stub-sig', key_id: 'key-1' };
  }

  @Post('telemetry')
  @HttpCode(204)
  async reportTelemetry(@Body() body: { device_id: string; current_release_id?: string; playback_status?: string }) {
    // Forward to audit service
  }
}
