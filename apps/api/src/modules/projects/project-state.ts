import type { ProjectStatus } from '@ecosoft/shared';
import { AppError } from '../../common/app-error';

const transitions: Record<ProjectStatus, readonly ProjectStatus[]> = {
  PROPUESTO: ['EN_DESARROLLO', 'SUSPENDIDO'],
  EN_DESARROLLO: ['EN_CONSTRUCCION', 'SUSPENDIDO'],
  EN_CONSTRUCCION: ['OPERATIVO', 'SUSPENDIDO'],
  OPERATIVO: ['SUSPENDIDO', 'FINALIZADO'],
  SUSPENDIDO: ['EN_DESARROLLO', 'EN_CONSTRUCCION', 'OPERATIVO', 'FINALIZADO'],
  FINALIZADO: [],
};

export const assertProjectTransition = (current: ProjectStatus, next: ProjectStatus): void => {
  if (!transitions[current].includes(next))
    throw new AppError(
      409,
      'INVALID_PROJECT_TRANSITION',
      `No se puede cambiar de ${current} a ${next}.`,
    );
};
