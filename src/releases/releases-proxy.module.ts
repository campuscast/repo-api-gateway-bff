import { Module } from '@nestjs/common';
import { ReleasesProxyController } from './releases-proxy.controller';

@Module({
  controllers: [ReleasesProxyController],
})
export class ReleasesProxyModule {}
