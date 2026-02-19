import { Module } from '@nestjs/common';
import { DevicesProxyController } from './devices-proxy.controller';
@Module({ controllers: [DevicesProxyController] })
export class DevicesProxyModule {}
