import { Module } from '@nestjs/common';
import { MetricsModule } from '@campuscast/shared-libs';
import { ConfigModule } from '@nestjs/config';
import { AuthProxyModule } from './auth/auth-proxy.module';
import { ZonesProxyModule } from './zones/zones-proxy.module';
import { DevicesProxyModule } from './devices/devices-proxy.module';
import { ContentProxyModule } from './content/content-proxy.module';
import { ScheduleProxyModule } from './schedule/schedule-proxy.module';
import { PlayerModule } from './player/player.module';
import { AuditProxyModule } from './audit/audit-proxy.module';
import { HealthController } from './common/health.controller';
import { appConfig, redisConfig, validate } from './config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, redisConfig],
      validate,
    }),
    AuthProxyModule,
    ZonesProxyModule,
    DevicesProxyModule,
    ContentProxyModule,
    ScheduleProxyModule,
    PlayerModule,
    AuditProxyModule,
      MetricsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
