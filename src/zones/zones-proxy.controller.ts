import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

@Controller('api/v1/zones')
export class ZonesProxyController {
  @Get()
  async listZones(@Query('page') page = 1, @Query('page_size') pageSize = 20) {
    // Proxy to zone-policy service
    return { data: [], pagination: { total: 0, page, page_size: pageSize } };
  }

  @Get(':zoneId/policy')
  async getPolicy(@Param('zoneId') zoneId: string) {
    return { zone_id: zoneId, crdt_enabled: false, max_schedule_slots: 100, max_ops_per_minute: 60, max_batch_size: 50 };
  }
}
