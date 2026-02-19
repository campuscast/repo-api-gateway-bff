import { Module } from '@nestjs/common';
import { ZonesProxyController } from './zones-proxy.controller';
@Module({ controllers: [ZonesProxyController] })
export class ZonesProxyModule {}
