import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthProxyModule } from './auth/auth-proxy.module';
import { ZonesProxyModule } from './zones/zones-proxy.module';
import { DevicesProxyModule } from './devices/devices-proxy.module';
import { ContentProxyModule } from './content/content-proxy.module';
import { ScheduleProxyModule } from './schedule/schedule-proxy.module';
import { PlayerModule } from './player/player.module';
import { AuditProxyModule } from './audit/audit-proxy.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthProxyModule,
    ZonesProxyModule,
    DevicesProxyModule,
    ContentProxyModule,
    ScheduleProxyModule,
    PlayerModule,
    AuditProxyModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
