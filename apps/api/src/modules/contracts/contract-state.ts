import type { ContractStatus } from '@ecosoft/shared';
import { AppError } from '../../common/app-error';

const transitions: Record<ContractStatus, readonly ContractStatus[]> = {
  BORRADOR: ['PENDIENTE_FIRMA', 'CANCELADO'],
  PENDIENTE_FIRMA: ['VIGENTE', 'CANCELADO'],
  VIGENTE: ['SUSPENDIDO', 'VENCIDO', 'CANCELADO'],
  SUSPENDIDO: ['VIGENTE', 'CANCELADO'],
  VENCIDO: [],
  CANCELADO: [],
};

export const assertContractTransition = (current: ContractStatus, next: ContractStatus): void => {
  if (!transitions[current].includes(next))
    throw new AppError(
      409,
      'INVALID_CONTRACT_TRANSITION',
      `No se puede cambiar de ${current} a ${next}.`,
    );
};
