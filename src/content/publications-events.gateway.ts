import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';

export type PublicationBroadcastEvent = {
  type: 'publication.changed';
  action: 'created' | 'updated' | 'archived';
  publication_id: string;
  zone_id: string;
  occurred_at: string;
};

@WebSocketGateway({ path: '/ws/publications' })
export class PublicationsEventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: {
    clients?: Iterable<{
      readyState?: number;
      send?: (payload: string) => void;
    }>;
  };

  private readonly logger = new Logger(PublicationsEventsGateway.name);

  handleConnection(_client: unknown) {
    this.logger.debug('Publications client connected');
  }

  handleDisconnect(_client: unknown) {
    this.logger.debug('Publications client disconnected');
  }

  broadcast(event: PublicationBroadcastEvent) {
    if (!this.server?.clients) {
      return;
    }

    const payload = JSON.stringify(event);
    for (const client of this.server.clients) {
      if (client.readyState === 1) {
        client.send?.(payload);
      }
    }
  }
}
