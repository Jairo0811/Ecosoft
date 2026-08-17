import type { RegulationStatus } from '@ecosoft/shared';
import { AppError } from '../../common/app-error';

const transitions: Record<RegulationStatus, readonly RegulationStatus[]> = {
  BORRADOR: ['VIGENTE'],
  VIGENTE: ['SUSPENDIDA', 'DEROGADA'],
  SUSPENDIDA: ['VIGENTE', 'DEROGADA'],
  DEROGADA: [],
};

export const assertRegulationTransition = (
  current: RegulationStatus,
  next: RegulationStatus,
): void => {
  if (!transitions[current].includes(next)) {
    throw new AppError(
      409,
      'INVALID_REGULATION_TRANSITION',
      `No se permite cambiar una regulación de ${current} a ${next}.`,
    );
  }
};
