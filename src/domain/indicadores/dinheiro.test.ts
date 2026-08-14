import { describe, it, expect } from 'vitest';
import { calcularDinheiro, type AtendimentoBruto } from './dinheiro';

const AGORA = new Date('2026-08-14T18:00:00Z');

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

describe('calcularDinheiro', () => {
  it('faturamento conta só o que foi atendido', () => {
    const r = calcularDinheiro(
      [item(), item(), item({ status: 'CANCELED' }), item({ status: 'NO_SHOW' })],
      AGORA,
    );
    expect(r.faturamentoCents).toBe(9000);
    expect(r.atendimentos).toBe(2);
  });

  it('agendado do futuro é previsto, nunca faturamento', () => {
    const r = calcularDinheiro(
      [item(), item({ status: 'BOOKED', startAt: new Date('2026-08-20T12:00:00Z') })],
      AGORA,
    );
    expect(r.faturamentoCents).toBe(4500);
    expect(r.previstoCents).toBe(4500);
  });

  it('ticket médio é faturamento sobre atendimentos, não sobre tudo', () => {
    const r = calcularDinheiro(
      [item({ precoCents: 4000 }), item({ precoCents: 6000 }), item({ status: 'NO_SHOW' })],
      AGORA,
    );
    expect(r.ticketMedioCents).toBe(5000);
  });

  it('receita perdida é o preço de quem faltou', () => {
    const r = calcularDinheiro([item(), item({ status: 'NO_SHOW', precoCents: 7000 })], AGORA);
    expect(r.perdidoCents).toBe(7000);
  });

  it('período sem atendimento devolve zero sem dividir por zero', () => {
    const r = calcularDinheiro([], AGORA);
    expect(r).toEqual({
      faturamentoCents: 0,
      ticketMedioCents: 0,
      atendimentos: 0,
      perdidoCents: 0,
      previstoCents: 0,
    });
  });

  it('usa o preço do snapshot, não o preço atual do serviço', () => {
    // o snapshot é o contrato: mudar o preço amanhã não reescreve o histórico
    const r = calcularDinheiro([item({ precoCents: 3000 })], AGORA);
    expect(r.faturamentoCents).toBe(3000);
  });
});
