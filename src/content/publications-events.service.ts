import { Injectable } from '@nestjs/common';
import { PublicationsEventsGateway, type PublicationBroadcastEvent } from './publications-events.gateway';

@Injectable()
export class PublicationsEventsService {
  constructor(private readonly gateway: PublicationsEventsGateway) {}

  publishChange(payload: Omit<PublicationBroadcastEvent, 'type' | 'occurred_at'>) {
    this.gateway.broadcast({
      type: 'publication.changed',
      occurred_at: new Date().toISOString(),
      ...payload,
    });
  }
}
