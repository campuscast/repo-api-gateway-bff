import { Module } from '@nestjs/common';
import { PolicyProxyController, ZonesProxyController } from './zones-proxy.controller';
import { AdminGuard } from '../common/admin.guard';

@Module({
  controllers: [ZonesProxyController, PolicyProxyController],
  providers: [AdminGuard],
})
export class ZonesProxyModule {}
