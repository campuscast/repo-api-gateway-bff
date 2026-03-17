import { Module } from '@nestjs/common';
import { UsersProxyController } from './users-proxy.controller';

@Module({
  controllers: [UsersProxyController],
})
export class UsersProxyModule {}
