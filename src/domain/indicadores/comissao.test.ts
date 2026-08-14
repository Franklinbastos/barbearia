import { describe, it, expect } from 'vitest';
import { calcularComissao, detalharComissao } from './comissao';
import type { AtendimentoBruto } from './dinheiro';

function item(over: Partial<AtendimentoBruto> = {}): AtendimentoBruto {
  return {
    id: crypto.randomUUID(), staffId: 'a', customerId: 'c1',
    startAt: new Date('2026-08-14T12:00:00Z'), endAt: new Date('2026-08-14T12:30:00Z'),
    status: 'DONE', origin: 'PUBLIC', precoCents: 5000, canceledAt: null, ...over,
  };
}

const BARBEIROS = [
  { id: 'a', nome: 'João', ativo: true, percentual: 40 },
  { id: 'b', nome: 'Pedro', ativo: true, percentual: 50 },
  { id: 'c', nome: 'Dono', ativo: true, percentual: null },
];

describe('calcularComissao', () => {
  it('aplica o percentual sobre o que o barbeiro produziu', () => {
    const r = calcularComissao([item(), item()], BARBEIROS);
    const joao = r.find((x) => x.staffId === 'a')!;
    expect(joao.baseCents).toBe(10000);
    expect(joao.comissaoCents).toBe(4000);
  });

  it('cada barbeiro com o próprio percentual', () => {
    const r = calcularComissao([item(), item({ staffId: 'b' })], BARBEIROS);
    expect(r.find((x) => x.staffId === 'a')!.comissaoCents).toBe(2000);
    expect(r.find((x) => x.staffId === 'b')!.comissaoCents).toBe(2500);
  });

  it('barbeiro sem percentual não aparece — nulo não é zero', () => {
    const r = calcularComissao([item({ staffId: 'c' })], BARBEIROS);
    expect(r.find((x) => x.staffId === 'c')).toBeUndefined();
  });

  it('falta e cancelamento não geram comissão', () => {
    const r = calcularComissao([item({ status: 'NO_SHOW' }), item({ status: 'CANCELED' })], BARBEIROS);
    expect(r.find((x) => x.staffId === 'a')?.comissaoCents ?? 0).toBe(0);
  });

  it('agendado do futuro não gera comissão: ainda não foi atendido', () => {
    const r = calcularComissao([item({ status: 'BOOKED' })], BARBEIROS);
    expect(r.find((x) => x.staffId === 'a')?.comissaoCents ?? 0).toBe(0);
  });

  it('arredonda o centavo para baixo, e a soma do detalhe bate com o total', () => {
    // 3333 centavos a 40% = 1333,2 → 1333
    const itens = [item({ precoCents: 3333 }), item({ precoCents: 3333 }), item({ precoCents: 3333 })];
    const total = calcularComissao(itens, BARBEIROS).find((x) => x.staffId === 'a')!;
    const detalhe = detalharComissao(itens, 'a', 40);
    expect(detalhe.reduce((s, d) => s + d.comissaoCents, 0)).toBe(total.comissaoCents);
  });

  it('zero é configuração e aparece; nulo é ausência e some', () => {
    const r = calcularComissao([item({ staffId: 'z' }), item({ staffId: 'c' })], [
      ...BARBEIROS,
      { id: 'z', nome: 'Zerado', ativo: true, percentual: 0 },
    ]);
    expect(r.find((x) => x.staffId === 'z')).toMatchObject({ baseCents: 5000, comissaoCents: 0 });
    expect(r.find((x) => x.staffId === 'c')).toBeUndefined();
  });

  it('barbeiro comissionado sem atendimento aparece zerado — no fechamento isso é resposta', () => {
    const r = calcularComissao([item()], BARBEIROS);
    expect(r.find((x) => x.staffId === 'b')).toMatchObject({
      baseCents: 0,
      comissaoCents: 0,
      atendimentos: 0,
    });
  });

  it('atendimento de barbeiro fora da lista não vira linha sem nome', () => {
    const r = calcularComissao([item({ staffId: 'fantasma' })], BARBEIROS);
    expect(r.map((x) => x.staffId)).not.toContain('fantasma');
  });

  it('percentual fora da faixa é contido em vez de virar comissão absurda', () => {
    const r = calcularComissao([item({ staffId: 'x' })], [
      { id: 'x', nome: 'Torto', ativo: true, percentual: 400 },
    ]);
    expect(r[0].comissaoCents).toBe(5000);
  });

  it('barbeiro desativado sem atendimento no período some do fechamento', () => {
    // Ele saiu da barbearia; o percentual continua no cadastro. Uma linha
    // zerada no fechamento de agosto é o nome de quem não trabalha mais ali
    // ocupando espaço na conferência — e, pior, sugerindo que há algo a pagar.
    const r = calcularComissao([item()], [
      ...BARBEIROS,
      { id: 'saiu', nome: 'Saiu', ativo: false, percentual: 40 },
    ]);
    expect(r.map((x) => x.staffId)).not.toContain('saiu');
  });

  it('barbeiro desativado que produziu no período continua no fechamento: ele tem a receber', () => {
    const r = calcularComissao([item({ staffId: 'saiu' })], [
      ...BARBEIROS,
      { id: 'saiu', nome: 'Saiu', ativo: false, percentual: 40 },
    ]);
    expect(r.find((x) => x.staffId === 'saiu')).toMatchObject({ comissaoCents: 2000 });
  });
});

describe('detalharComissao', () => {
  it('devolve uma linha por atendimento — é o que encerra a discussão do fechamento', () => {
    const d = detalharComissao([item(), item()], 'a', 40);
    expect(d).toHaveLength(2);
    expect(d[0].comissaoCents).toBe(2000);
  });

  it('só do barbeiro pedido', () => {
    expect(detalharComissao([item(), item({ staffId: 'b' })], 'a', 40)).toHaveLength(1);
  });

  it('em ordem cronológica, que é como o fechamento é conferido', () => {
    const d = detalharComissao(
      [
        item({ startAt: new Date('2026-08-14T16:00:00Z') }),
        item({ startAt: new Date('2026-08-14T09:00:00Z') }),
      ],
      'a',
      40,
    );
    expect(d.map((l) => l.quando.toISOString())).toEqual([
      '2026-08-14T09:00:00.000Z',
      '2026-08-14T16:00:00.000Z',
    ]);
  });
});
