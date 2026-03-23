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
import { UsersProxyModule } from './users/users-proxy.module';
import { RolesProxyModule } from './roles/roles-proxy.module';
import { SystemProxyModule } from './system/system-proxy.module';
import { ReleasesProxyModule } from './releases/releases-proxy.module';
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
    UsersProxyModule,
    RolesProxyModule,
    SystemProxyModule,
    ZonesProxyModule,
    DevicesProxyModule,
    ContentProxyModule,
    ScheduleProxyModule,
    ReleasesProxyModule,
    PlayerModule,
    AuditProxyModule,
    MetricsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
