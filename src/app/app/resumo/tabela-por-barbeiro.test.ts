import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';

import type { AtendimentoBruto } from '@/domain/indicadores/dinheiro';
import type { Janela } from '@/domain/indicadores/periodo';
import { montarLinhasPorBarbeiro, type BarbeiroDaTabela } from './tabela-por-barbeiro';

const TZ = 'America/Sao_Paulo';

/** Segunda 10/08/2026 a domingo 16/08/2026. */
const JANELA: Janela = {
  inicio: DateTime.fromISO('2026-08-10T00:00', { zone: TZ }).toJSDate(),
  fim: DateTime.fromISO('2026-08-17T00:00', { zone: TZ }).toJSDate(),
  rotulo: '10 a 16 de agosto',
  periodo: 'semana',
};

const AGORA = DateTime.fromISO('2026-08-17T00:00', { zone: TZ }).toJSDate();

function em(iso: string): Date {
  return DateTime.fromISO(iso, { zone: TZ }).toJSDate();
}

function item(over: Partial<AtendimentoBruto> = {}): AtendimentoBruto {
  return {
    id: crypto.randomUUID(),
    staffId: 'a',
    customerId: 'c1',
    startAt: em('2026-08-11T10:00'),
    endAt: em('2026-08-11T10:30'),
    status: 'DONE',
    origin: 'PUBLIC',
    precoCents: 5000,
    canceledAt: null,
    ...over,
  };
}

const BARBEIROS: BarbeiroDaTabela[] = [
  { id: 'a', nome: 'João', ativo: true, percentual: 40 },
  { id: 'b', nome: 'Pedro', ativo: true, percentual: null },
];

const base = {
  barbeiros: BARBEIROS,
  historico: [] as AtendimentoBruto[],
  ocupacao: new Map(),
  janela: JANELA,
  agora: AGORA,
};

describe('montarLinhasPorBarbeiro', () => {
  it('cada barbeiro só recebe os próprios atendimentos', () => {
    const linhas = montarLinhasPorBarbeiro({
      ...base,
      itens: [item(), item(), item({ staffId: 'b', precoCents: 3000 })],
    });

    expect(linhas.find((l) => l.staffId === 'a')).toMatchObject({
      atendimentos: 2,
      faturamentoCents: 10000,
      ticketMedioCents: 5000,
    });
    expect(linhas.find((l) => l.staffId === 'b')).toMatchObject({
      atendimentos: 1,
      faturamentoCents: 3000,
    });
  });

  it('comissão nula é ausência de configuração, não zero', () => {
    const linhas = montarLinhasPorBarbeiro({ ...base, itens: [item(), item({ staffId: 'b' })] });

    expect(linhas.find((l) => l.staffId === 'a')!.comissaoCents).toBe(2000);
    expect(linhas.find((l) => l.staffId === 'b')!.comissaoCents).toBeNull();
  });

  it('ocupação sem expediente cadastrado é traço, não 0%', () => {
    const semExpediente = montarLinhasPorBarbeiro({ ...base, itens: [item()] });
    expect(semExpediente.find((l) => l.staffId === 'a')!.ocupacao).toBeNull();

    const comExpediente = montarLinhasPorBarbeiro({
      ...base,
      itens: [item()],
      ocupacao: new Map([['a', { disponiveis: 120, ocupados: 30, taxa: 0.25 }]]),
    });
    expect(comExpediente.find((l) => l.staffId === 'a')!.ocupacao).toBeCloseTo(0.25);
  });

  it('taxa de falta só existe quando houve atendido ou falta', () => {
    const semNada = montarLinhasPorBarbeiro({ ...base, itens: [item({ status: 'CANCELED' })] });
    expect(semNada.find((l) => l.staffId === 'a')!.taxaFalta).toBeNull();

    const comFalta = montarLinhasPorBarbeiro({
      ...base,
      itens: [item(), item({ status: 'NO_SHOW' })],
    });
    expect(comFalta.find((l) => l.staffId === 'a')!.taxaFalta).toBeCloseTo(0.5);
  });

  it('retorno é do barbeiro: quem voltou para outro não conta como retenção dele', () => {
    // A estreia de c9 foi com o João, há mais de 90 dias, e a volta foi com o
    // Pedro. Para o João isso é cliente perdido, e é exatamente o que a coluna
    // precisa mostrar.
    const janelaAntiga: Janela = {
      inicio: em('2026-01-05T00:00'),
      fim: em('2026-01-12T00:00'),
      rotulo: 'janeiro',
      periodo: 'semana',
    };

    const historico = [
      item({ staffId: 'a', customerId: 'c9', startAt: em('2026-01-06T10:00') }),
      item({ staffId: 'b', customerId: 'c9', startAt: em('2026-02-10T10:00') }),
    ];

    const linhas = montarLinhasPorBarbeiro({
      ...base,
      janela: janelaAntiga,
      itens: [],
      historico,
    });

    expect(linhas.find((l) => l.staffId === 'a')).toMatchObject({ novos: 1, taxaRetorno: 0 });
    // Para o Pedro, c9 estreou em fevereiro — fora da janela de janeiro.
    expect(linhas.find((l) => l.staffId === 'b')!.novos).toBe(0);
  });

  it('coorte que ainda não teve 90 dias para voltar é traço, não 0%', () => {
    const linhas = montarLinhasPorBarbeiro({
      ...base,
      itens: [item()],
      historico: [item()],
    });
    expect(linhas.find((l) => l.staffId === 'a')!.taxaRetorno).toBeNull();
  });

  it('barbeiro desativado só aparece se produziu no período', () => {
    const barbeiros: BarbeiroDaTabela[] = [
      ...BARBEIROS,
      { id: 'saiu', nome: 'Saiu', ativo: false, percentual: 40 },
    ];

    expect(
      montarLinhasPorBarbeiro({ ...base, barbeiros, itens: [] }).map((l) => l.staffId),
    ).not.toContain('saiu');

    expect(
      montarLinhasPorBarbeiro({ ...base, barbeiros, itens: [item({ staffId: 'saiu' })] }).map(
        (l) => l.staffId,
      ),
    ).toContain('saiu');
  });

  it('ordena pelo faturamento, que é a leitura que o dono faz da tabela', () => {
    const linhas = montarLinhasPorBarbeiro({
      ...base,
      itens: [item({ precoCents: 1000 }), item({ staffId: 'b', precoCents: 9000 })],
    });
    expect(linhas.map((l) => l.staffId)).toEqual(['b', 'a']);
  });
});
