import { Module } from '@nestjs/common';
import { ContentProxyController } from './content-proxy.controller';
import { PublicationsProxyController } from './publications-proxy.controller';

@Module({ controllers: [ContentProxyController, PublicationsProxyController] })
export class ContentProxyModule {}
