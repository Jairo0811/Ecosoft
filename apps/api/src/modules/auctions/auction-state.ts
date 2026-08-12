import type { AuctionStatus } from '@ecosoft/shared';
import { AppError } from '../../common/app-error';

const transitions: Record<AuctionStatus, readonly AuctionStatus[]> = {
  BORRADOR: ['PROGRAMADA', 'PUBLICADA', 'CANCELADA'],
  PROGRAMADA: ['PUBLICADA', 'CANCELADA'],
  PUBLICADA: ['ABIERTA', 'CANCELADA'],
  ABIERTA: ['CERRADA', 'CANCELADA'],
  CERRADA: ['EN_EVALUACION', 'CANCELADA'],
  EN_EVALUACION: ['ADJUDICADA', 'CANCELADA'],
  ADJUDICADA: ['FINALIZADA'],
  CANCELADA: [],
  FINALIZADA: [],
};

export const assertAuctionTransition = (current: AuctionStatus, next: AuctionStatus): void => {
  if (!transitions[current].includes(next)) {
    throw new AppError(
      409,
      'INVALID_AUCTION_TRANSITION',
      `No se permite cambiar una subasta de ${current} a ${next}.`,
    );
  }
};

export const editableAuctionStatuses: readonly AuctionStatus[] = ['BORRADOR', 'PROGRAMADA'];
