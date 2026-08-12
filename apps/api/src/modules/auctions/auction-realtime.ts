import type { AuctionStatus } from '@ecosoft/shared';

export interface AuctionRealtimeEvent {
  auctionId: string;
  code: string;
  type: 'STATUS_CHANGED';
  previousStatus: AuctionStatus;
  newStatus: AuctionStatus;
  occurredAt: string;
}

export interface AuctionRealtimePublisher {
  publish(event: AuctionRealtimeEvent): Promise<void>;
}

// Puerto estable para Socket.IO. El adaptador de red se incorporará con la recepción de ofertas,
// cuando existan consumidores en vivo y reglas formales de confidencialidad.
export const auctionRealtime: AuctionRealtimePublisher = {
  async publish(): Promise<void> {
    return Promise.resolve();
  },
};
