import { assertContractTransition } from './contract-state';

describe('contract state machine', () => {
  it('accepts signature, activation and suspension', () => {
    expect(() => assertContractTransition('BORRADOR', 'PENDIENTE_FIRMA')).not.toThrow();
    expect(() => assertContractTransition('PENDIENTE_FIRMA', 'VIGENTE')).not.toThrow();
    expect(() => assertContractTransition('VIGENTE', 'SUSPENDIDO')).not.toThrow();
    expect(() => assertContractTransition('SUSPENDIDO', 'VIGENTE')).not.toThrow();
  });

  it('keeps terminal states closed', () => {
    expect(() => assertContractTransition('VENCIDO', 'VIGENTE')).toThrow('No se puede cambiar');
    expect(() => assertContractTransition('CANCELADO', 'BORRADOR')).toThrow('No se puede cambiar');
  });
});
