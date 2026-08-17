import { assertRegulationTransition } from './regulatory-state';

describe('assertRegulationTransition', () => {
  it('allows publishing a draft and suspending an active regulation', () => {
    expect(() => assertRegulationTransition('BORRADOR', 'VIGENTE')).not.toThrow();
    expect(() => assertRegulationTransition('VIGENTE', 'SUSPENDIDA')).not.toThrow();
  });

  it('keeps repealed regulations terminal', () => {
    expect(() => assertRegulationTransition('DEROGADA', 'VIGENTE')).toThrow(
      'No se permite cambiar una regulación',
    );
  });
});
