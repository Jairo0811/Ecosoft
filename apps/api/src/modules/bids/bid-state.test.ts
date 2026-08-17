import { assertBidTransition } from './bid-state';

describe('bid state', () => {
  it('allows submission and evaluation transitions', () => {
    expect(() => assertBidTransition('BORRADOR', 'ENVIADA')).not.toThrow();
    expect(() => assertBidTransition('ENVIADA', 'EN_EVALUACION')).not.toThrow();
    expect(() => assertBidTransition('EN_EVALUACION', 'ADJUDICADA')).not.toThrow();
  });

  it('keeps final bids immutable', () => {
    expect(() => assertBidTransition('ADJUDICADA', 'BORRADOR')).toThrow('No se puede cambiar');
  });
});
