import { Module } from '@nestjs/common';
import { ScheduleProxyController } from './schedule-proxy.controller';
@Module({ controllers: [ScheduleProxyController] })
export class ScheduleProxyModule {}
