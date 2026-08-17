import type { BidStatus } from '@ecosoft/shared';
import { AppError } from '../../common/app-error';

const transitions: Record<BidStatus, readonly BidStatus[]> = {
  BORRADOR: ['ENVIADA'],
  ENVIADA: ['RETIRADA', 'EN_EVALUACION'],
  RETIRADA: [],
  EN_EVALUACION: ['ADJUDICADA', 'NO_SELECCIONADA'],
  ADJUDICADA: [],
  NO_SELECCIONADA: [],
};

export const assertBidTransition = (current: BidStatus, next: BidStatus): void => {
  if (!transitions[current].includes(next)) {
    throw new AppError(
      409,
      'INVALID_BID_TRANSITION',
      `No se puede cambiar de ${current} a ${next}.`,
    );
  }
};
