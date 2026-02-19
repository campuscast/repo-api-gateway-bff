import { Module } from '@nestjs/common';
import { ContentProxyController } from './content-proxy.controller';
@Module({ controllers: [ContentProxyController] })
export class ContentProxyModule {}
