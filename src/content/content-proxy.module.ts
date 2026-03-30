import { Module } from '@nestjs/common';
import { ContentProxyController } from './content-proxy.controller';
import { PublicationsEventsGateway } from './publications-events.gateway';
import { PublicationsEventsService } from './publications-events.service';
import { PublicationsProxyController } from './publications-proxy.controller';

@Module({
  controllers: [ContentProxyController, PublicationsProxyController],
  providers: [PublicationsEventsGateway, PublicationsEventsService],
})
export class ContentProxyModule {}
