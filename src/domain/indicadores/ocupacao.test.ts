import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { calcularOcupacao, type BlocoDeTrabalho } from './ocupacao';
import type { AtendimentoBruto } from './dinheiro';

const TZ = 'America/Sao_Paulo';

/** Segunda 10/08/2026, das 09:00 às 12:00 = 180 minutos. */
const EXPEDIENTE: BlocoDeTrabalho[] = [
  { staffId: 'a', weekday: 1, startTime: '09:00:00', endTime: '12:00:00' },
];

const JANELA_SEGUNDA = {
  inicio: DateTime.fromISO('2026-08-10T00:00', { zone: TZ }).toJSDate(),
  fim: DateTime.fromISO('2026-08-11T00:00', { zone: TZ }).toJSDate(),
  rotulo: 'seg, 10 de agosto',
  periodo: 'hoje' as const,
};

/** Fim do dia: nada de "já passou" para descontar. */
const DEPOIS = DateTime.fromISO('2026-08-10T23:00', { zone: TZ }).toJSDate();

function em(hora: string): Date {
  return DateTime.fromISO(`2026-08-10T${hora}`, { zone: TZ }).toJSDate();
}

function item(inicio: string, fim: string, over: Partial<AtendimentoBruto> = {}): AtendimentoBruto {
  return {
    id: crypto.randomUUID(), staffId: 'a', customerId: 'c1',
    startAt: em(inicio), endAt: em(fim),
    status: 'DONE', origin: 'PUBLIC', precoCents: 4500, canceledAt: null, ...over,
  };
}

const base = { expediente: EXPEDIENTE, bloqueios: [], janela: JANELA_SEGUNDA, timeZone: TZ, agora: DEPOIS };

describe('calcularOcupacao — denominador', () => {
  it('disponível é o expediente do dia', () => {
    const r = calcularOcupacao({ ...base, itens: [] });
    expect(r.minutosDisponiveis).toBe(180);
    expect(r.taxa).toBe(0);
  });

  it('bloqueio sai do disponível — hora que o barbeiro não estava lá não conta contra ele', () => {
    const r = calcularOcupacao({
      ...base, itens: [],
      bloqueios: [{ staffId: 'a', startAt: em('10:00'), endAt: em('11:00') }],
    });
    expect(r.minutosDisponiveis).toBe(120);
  });

  it('bloqueio que passa das bordas do expediente só desconta a parte que intersecta', () => {
    const r = calcularOcupacao({
      ...base, itens: [],
      bloqueios: [{ staffId: 'a', startAt: em('07:00'), endAt: em('10:00') }],
    });
    expect(r.minutosDisponiveis).toBe(120); // só das 9 às 10 conta
  });

  it('num dia em curso, o que ainda não chegou não é disponível', () => {
    // são 10:00; das 10 às 12 ainda pode ser vendido, mas não é ociosidade
    const r = calcularOcupacao({ ...base, itens: [], agora: em('10:00') });
    expect(r.minutosDisponiveis).toBe(60);
  });

  it('dia sem expediente não entra na conta', () => {
    const domingo = {
      ...JANELA_SEGUNDA,
      inicio: DateTime.fromISO('2026-08-09T00:00', { zone: TZ }).toJSDate(),
      fim: DateTime.fromISO('2026-08-10T00:00', { zone: TZ }).toJSDate(),
    };
    const r = calcularOcupacao({ ...base, itens: [], janela: domingo });
    expect(r.minutosDisponiveis).toBe(0);
    // Nulo, e não zero: `0%` de ocupação num domingo fechado lê como cadeira
    // parada, que é acusação falsa. Quem não tem denominador não tem taxa.
    expect(r.taxa).toBeNull();
  });

  it('barbeiro sem expediente na janela não tem taxa, e não 0%', () => {
    const r = calcularOcupacao({
      ...base,
      itens: [],
      expediente: [{ staffId: 'a', weekday: 3, startTime: '09:00:00', endTime: '12:00:00' }],
    });
    expect(r.taxa).toBeNull();
  });

  it('bloco de expediente que vira a meia-noite não some calado', () => {
    // 22:00 → 02:00 devolvia zero minuto e o barbeiro sumia do denominador: a
    // ocupação da loja inteira subia sem que nada tivesse acontecido. O produto
    // não suporta expediente virando o dia (`validateWorkingBlocks` rejeita na
    // gravação), então aqui a linha só pode ter vindo de fora do produto — e
    // fica sabido, em vez de virar número errado.
    expect(() =>
      calcularOcupacao({
        ...base,
        itens: [],
        expediente: [{ staffId: 'a', weekday: 1, startTime: '22:00:00', endTime: '02:00:00' }],
      }),
    ).toThrow(/meia-noite/i);
  });

  it('expediente com hora ilegível também não passa calado', () => {
    expect(() =>
      calcularOcupacao({
        ...base,
        itens: [],
        expediente: [{ staffId: 'a', weekday: 1, startTime: 'manhã', endTime: '12:00:00' }],
      }),
    ).toThrow(/hora/i);
  });

  it("'24:00:00' continua sendo a meia-noite do dia seguinte, não bloco invertido", () => {
    const r = calcularOcupacao({
      ...base,
      itens: [],
      // O dia inteiro já passou: sem isto o corte do "ainda não chegou" comeria
      // a última hora e o teste mediria outra coisa.
      agora: DateTime.fromISO('2026-08-11T00:00', { zone: TZ }).toJSDate(),
      expediente: [{ staffId: 'a', weekday: 1, startTime: '22:00:00', endTime: '24:00:00' }],
    });
    expect(r.minutosDisponiveis).toBe(120);
  });
});

describe('calcularOcupacao — numerador', () => {
  it('atendido ocupa', () => {
    const r = calcularOcupacao({ ...base, itens: [item('09:00', '10:00')] });
    expect(r.minutosOcupados).toBe(60);
    expect(r.taxa).toBeCloseTo(60 / 180);
  });

  it('agendado ainda não atendido também ocupa: a cadeira está reservada', () => {
    const r = calcularOcupacao({ ...base, itens: [item('09:00', '10:00', { status: 'BOOKED' })] });
    expect(r.minutosOcupados).toBe(60);
  });

  it('FALTA OCUPA — é o ponto do indicador', () => {
    // a cadeira ficou reservada, ninguém pôde usar, e o dono precisa ver isso
    const r = calcularOcupacao({ ...base, itens: [item('09:00', '10:00', { status: 'NO_SHOW' })] });
    expect(r.minutosOcupados).toBe(60);
  });

  it('cancelado não ocupa: o horário voltou para a grade', () => {
    const r = calcularOcupacao({ ...base, itens: [item('09:00', '10:00', { status: 'CANCELED' })] });
    expect(r.minutosOcupados).toBe(0);
  });

  it('atendimento que vaza do expediente conta só a parte de dentro', () => {
    const r = calcularOcupacao({ ...base, itens: [item('11:30', '13:00')] });
    expect(r.minutosOcupados).toBe(30);
  });
});

describe('calcularOcupacao — recortes', () => {
  it('separa por barbeiro, cada um com o próprio expediente', () => {
    const r = calcularOcupacao({
      ...base,
      expediente: [
        ...EXPEDIENTE,
        { staffId: 'b', weekday: 1, startTime: '09:00:00', endTime: '10:00:00' },
      ],
      itens: [item('09:00', '10:00'), item('09:00', '09:30', { staffId: 'b' })],
    });
    expect(r.porBarbeiro.get('a')).toMatchObject({ disponiveis: 180, ocupados: 60 });
    expect(r.porBarbeiro.get('b')).toMatchObject({ disponiveis: 60, ocupados: 30 });
    expect(r.minutosDisponiveis).toBe(240);
  });

  it('agrupa por dia da semana — é o que responde se a terça está vazia', () => {
    const semana = {
      ...JANELA_SEGUNDA,
      inicio: DateTime.fromISO('2026-08-10T00:00', { zone: TZ }).toJSDate(),
      fim: DateTime.fromISO('2026-08-17T00:00', { zone: TZ }).toJSDate(),
      periodo: 'semana' as const,
    };
    const r = calcularOcupacao({
      ...base,
      janela: semana,
      agora: DateTime.fromISO('2026-08-17T00:00', { zone: TZ }).toJSDate(),
      expediente: [
        { staffId: 'a', weekday: 1, startTime: '09:00:00', endTime: '12:00:00' },
        { staffId: 'a', weekday: 2, startTime: '09:00:00', endTime: '12:00:00' },
      ],
      itens: [item('09:00', '12:00')], // segunda cheia, terça vazia
    });
    const segunda = r.porDiaDaSemana.find((d) => d.weekday === 1);
    const terca = r.porDiaDaSemana.find((d) => d.weekday === 2);
    expect(segunda?.taxa).toBeCloseTo(1);
    expect(terca?.taxa).toBe(0);
  });

  it('agrupa por hora do dia', () => {
    const r = calcularOcupacao({ ...base, itens: [item('09:00', '10:00')] });
    expect(r.porHora.find((h) => h.hora === 9)?.taxa).toBeCloseTo(1);
    expect(r.porHora.find((h) => h.hora === 11)?.taxa).toBe(0);
  });
});
