import { Controller, Get, Query } from '@nestjs/common';

@Controller('api/v1/audit')
export class AuditProxyController {
  @Get()
  async queryEvents(
    @Query('zone_id') zoneId?: string,
    @Query('resource_type') resourceType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = 1,
    @Query('page_size') pageSize = 20,
  ) {
    return { data: [], pagination: { total: 0, page, page_size: pageSize } };
  }
}
