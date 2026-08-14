import { describe, it, expect } from 'vitest';
import { calcularComportamento } from './comportamento';
import type { AtendimentoBruto } from './dinheiro';

function item(over: Partial<AtendimentoBruto> = {}): AtendimentoBruto {
  return {
    id: crypto.randomUUID(),
    staffId: 'a',
    customerId: 'c1',
    startAt: new Date('2026-08-14T12:00:00Z'),
    endAt: new Date('2026-08-14T12:30:00Z'),
    status: 'DONE',
    origin: 'PUBLIC',
    precoCents: 4500,
    canceledAt: null,
    ...over,
  };
}

describe('calcularComportamento', () => {
  it('taxa de falta é falta sobre atendido mais falta — cancelado não entra', () => {
    const r = calcularComportamento([
      item(),
      item(),
      item(),
      item({ status: 'NO_SHOW' }),
      item({ status: 'CANCELED' }),
    ]);
    expect(r.taxaFalta).toBeCloseTo(0.25); // 1 de 4, e não 1 de 5
  });

  it('taxa de cancelamento é sobre o total do período', () => {
    const r = calcularComportamento([
      item(),
      item(),
      item({ status: 'CANCELED' }),
      item({ status: 'CANCELED' }),
    ]);
    expect(r.taxaCancelamento).toBeCloseTo(0.5);
  });

  it('cancelamento em cima da hora é o que caiu a menos de 24h do horário', () => {
    const r = calcularComportamento([
      item({
        status: 'CANCELED',
        startAt: new Date('2026-08-14T12:00:00Z'),
        canceledAt: new Date('2026-08-14T09:00:00Z'), // 3h antes
      }),
      item({
        status: 'CANCELED',
        startAt: new Date('2026-08-20T12:00:00Z'),
        canceledAt: new Date('2026-08-14T09:00:00Z'), // 6 dias antes
      }),
    ]);
    expect(r.cancelamentoEmCimaDaHora).toBe(1);
  });

  it('cancelado sem canceledAt não conta como em cima da hora', () => {
    const r = calcularComportamento([item({ status: 'CANCELED', canceledAt: null })]);
    expect(r.cancelamentoEmCimaDaHora).toBe(0);
  });

  it('conta a origem de cada agendamento', () => {
    const r = calcularComportamento([
      item(),
      item({ origin: 'PANEL' }),
      item({ origin: 'PANEL' }),
      item({ origin: 'BOT' }),
    ]);
    expect(r.porOrigem).toEqual({ PUBLIC: 1, PANEL: 2, BOT: 1 });
  });

  it('sem nada não há taxa nenhuma — nulo, e não zero', () => {
    // Zero afirmaria que ninguém faltou e ninguém cancelou de um universo que
    // não existe. A §5.12 da direção de UI manda traço, e o traço só existe se
    // o domínio souber dizer "não há do que tirar taxa".
    const r = calcularComportamento([]);
    expect(r.taxaFalta).toBeNull();
    expect(r.taxaCancelamento).toBeNull();
  });

  it('período só com cancelamento não tem taxa de falta: ninguém compareceu nem faltou', () => {
    const r = calcularComportamento([item({ status: 'CANCELED' }), item({ status: 'CANCELED' })]);
    expect(r.taxaFalta).toBeNull();
    expect(r.taxaCancelamento).toBe(1);
  });

  it('período só com agendado do futuro não tem taxa de falta', () => {
    expect(calcularComportamento([item({ status: 'BOOKED' })]).taxaFalta).toBeNull();
  });
});
