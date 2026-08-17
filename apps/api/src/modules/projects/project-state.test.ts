import { assertProjectTransition } from './project-state';

describe('project state machine', () => {
  it('accepts the operational lifecycle', () => {
    expect(() => assertProjectTransition('PROPUESTO', 'EN_DESARROLLO')).not.toThrow();
    expect(() => assertProjectTransition('EN_DESARROLLO', 'EN_CONSTRUCCION')).not.toThrow();
    expect(() => assertProjectTransition('EN_CONSTRUCCION', 'OPERATIVO')).not.toThrow();
  });

  it('rejects skipped and terminal transitions', () => {
    expect(() => assertProjectTransition('PROPUESTO', 'OPERATIVO')).toThrow('No se puede cambiar');
    expect(() => assertProjectTransition('FINALIZADO', 'OPERATIVO')).toThrow('No se puede cambiar');
  });
});
