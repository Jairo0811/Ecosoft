import { assertAuctionTransition } from './auction-state';

describe('auction state machine', () => {
  it('allows the regulated happy path', () => {
    expect(() => assertAuctionTransition('BORRADOR', 'PUBLICADA')).not.toThrow();
    expect(() => assertAuctionTransition('PUBLICADA', 'ABIERTA')).not.toThrow();
    expect(() => assertAuctionTransition('ABIERTA', 'CERRADA')).not.toThrow();
    expect(() => assertAuctionTransition('CERRADA', 'EN_EVALUACION')).not.toThrow();
    expect(() => assertAuctionTransition('EN_EVALUACION', 'ADJUDICADA')).not.toThrow();
    expect(() => assertAuctionTransition('ADJUDICADA', 'FINALIZADA')).not.toThrow();
  });

  it('rejects skipped or terminal transitions', () => {
    expect(() => assertAuctionTransition('BORRADOR', 'ADJUDICADA')).toThrow(/No se permite/);
    expect(() => assertAuctionTransition('CANCELADA', 'ABIERTA')).toThrow(/No se permite/);
    expect(() => assertAuctionTransition('ADJUDICADA', 'CANCELADA')).toThrow(/No se permite/);
  });
});
