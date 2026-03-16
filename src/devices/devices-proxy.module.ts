import { Module } from '@nestjs/common';
import { DevicesProxyController } from './devices-proxy.controller';
import { EnrollmentProxyController } from './enrollment-proxy.controller';

@Module({ controllers: [DevicesProxyController, EnrollmentProxyController] })
export class DevicesProxyModule {}
