import { Module } from '@nestjs/common';
import { SystemProxyController } from './system-proxy.controller';

@Module({
  controllers: [SystemProxyController],
})
export class SystemProxyModule {}
