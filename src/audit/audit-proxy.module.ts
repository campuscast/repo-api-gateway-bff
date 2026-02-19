import { Module } from '@nestjs/common';
import { AuditProxyController } from './audit-proxy.controller';
@Module({ controllers: [AuditProxyController] })
export class AuditProxyModule {}
