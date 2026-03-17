import { Module } from '@nestjs/common';
import { RolesProxyController } from './roles-proxy.controller';

@Module({
  controllers: [RolesProxyController],
})
export class RolesProxyModule {}
