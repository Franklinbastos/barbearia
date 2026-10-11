import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { folgasDoDia, resumoDoMes, situacaoDoDia, textoDasFolgas, type Expediente } from './folgas';

const TZ = 'America/Sao_Paulo';
const SEGUNDA = '2026-09-07';
const PEDRO = { id: 'pedro', name: 'Pedro' };
const TIAGO = { id: 'tiago', name: 'Tiago' };

function em(dia: string, hora: string): Date {
  return DateTime.fromISO(`${dia}T${hora}`, { zone: TZ }).toJSDate();
}

/** Pedro: seg a sáb, 09–12 e 13–19. Tiago: ter a sáb, 10–18 (não trabalha segunda). */
const EXPEDIENTES: Expediente[] = [
  ...[1, 2, 3, 4, 5, 6].flatMap((weekday) => [
    { staffId: 'pedro', weekday, startTime: '09:00:00', endTime: '12:00:00' },
    { staffId: 'pedro', weekday, startTime: '13:00:00', endTime: '19:00:00' },
  ]),
  ...[2, 3, 4, 5, 6].map((weekday) => ({ staffId: 'tiago', weekday, startTime: '10:00:00', endTime: '18:00:00' })),
];

describe('folgasDoDia', () => {
  it('dia da semana sem expediente é folga de semana', () => {
    expect(folgasDoDia(SEGUNDA, TZ, [PEDRO, TIAGO], EXPEDIENTES, [])).toEqual([
      { staffId: 'tiago', tipo: 'semana' },
    ]);
  });

  it('domingo (weekday 7 no Luxon) sem expediente conta', () => {
    const folgas = folgasDoDia('2026-09-13', TZ, [PEDRO, TIAGO], EXPEDIENTES, []);
    expect(folgas.map((f) => f.staffId).sort()).toEqual(['pedro', 'tiago']);
  });

  it('bloqueio cobrindo o expediente todo vira folga de bloqueio', () => {
    const bloqueios = [{ staffId: 'pedro', startAt: em(SEGUNDA, '09:00'), endAt: em(SEGUNDA, '19:00') }];
    expect(folgasDoDia(SEGUNDA, TZ, [PEDRO], EXPEDIENTES, bloqueios)).toEqual([
      { staffId: 'pedro', tipo: 'bloqueio' },
    ]);
  });

  it('bloqueios encadeados cobrindo os dois turnos também contam', () => {
    const bloqueios = [
      { staffId: 'pedro', startAt: em(SEGUNDA, '08:00'), endAt: em(SEGUNDA, '12:30') },
      { staffId: 'pedro', startAt: em(SEGUNDA, '12:30'), endAt: em(SEGUNDA, '20:00') },
    ];
    expect(folgasDoDia(SEGUNDA, TZ, [PEDRO], EXPEDIENTES, bloqueios)).toHaveLength(1);
  });

  it('almoço (bloqueio parcial) não é folga', () => {
    const bloqueios = [{ staffId: 'pedro', startAt: em(SEGUNDA, '12:00'), endAt: em(SEGUNDA, '13:00') }];
    expect(folgasDoDia(SEGUNDA, TZ, [PEDRO], EXPEDIENTES, bloqueios)).toEqual([]);
  });

  it('bloqueio que deixa uma hora do expediente livre não é folga', () => {
    const bloqueios = [{ staffId: 'pedro', startAt: em(SEGUNDA, '09:00'), endAt: em(SEGUNDA, '18:00') }];
    expect(folgasDoDia(SEGUNDA, TZ, [PEDRO], EXPEDIENTES, bloqueios)).toEqual([]);
  });

  it('bloqueio de outro barbeiro não conta', () => {
    const bloqueios = [{ staffId: 'tiago', startAt: em(SEGUNDA, '00:00'), endAt: em(SEGUNDA, '23:59') }];
    expect(folgasDoDia(SEGUNDA, TZ, [PEDRO], EXPEDIENTES, bloqueios)).toEqual([]);
  });

  it('barbeiro sem expediente nenhum cadastrado não vira folga todo dia', () => {
    const novato = { id: 'novato', name: 'Novato' };
    expect(folgasDoDia(SEGUNDA, TZ, [novato], EXPEDIENTES, [])).toEqual([]);
  });
});

describe('situacaoDoDia', () => {
  it('ninguém trabalha → fechado', () => {
    expect(situacaoDoDia('2026-09-13', TZ, [PEDRO, TIAGO], EXPEDIENTES, []).fechado).toBe(true);
  });

  it('alguém trabalha → aberto, com a folga de quem não trabalha', () => {
    const s = situacaoDoDia(SEGUNDA, TZ, [PEDRO, TIAGO], EXPEDIENTES, []);
    expect(s.fechado).toBe(false);
    expect(s.folgas).toEqual([{ staffId: 'tiago', tipo: 'semana' }]);
  });
});

describe('textoDasFolgas', () => {
  it('dia fechado diz só "Fechado"', () => {
    expect(textoDasFolgas([{ staffId: 'pedro', tipo: 'semana' }], new Map([['pedro', 'Pedro']]), true)).toBe('Fechado');
  });

  it('junta os nomes com o motivo', () => {
    const nomes = new Map([['pedro', 'Pedro'], ['tiago', 'Tiago']]);
    expect(
      textoDasFolgas([{ staffId: 'pedro', tipo: 'bloqueio' }, { staffId: 'tiago', tipo: 'semana' }], nomes),
    ).toBe('Pedro de folga · Tiago não trabalha');
  });

  it('sem folga, sem texto', () => {
    expect(textoDasFolgas([], new Map())).toBeNull();
  });
});

describe('resumoDoMes', () => {
  it('marca os dias e resume a folga semanal uma vez só', () => {
    const bloqueios = [{ staffId: 'pedro', startAt: em('2026-09-10', '09:00'), endAt: em('2026-09-10', '19:00') }];
    const { diasDeFolga, linhas } = resumoDoMes(2026, 9, TZ, [PEDRO, TIAGO], EXPEDIENTES, bloqueios);

    expect(diasDeFolga.has('2026-09-07')).toBe(true); // segunda: Tiago
    expect(diasDeFolga.has('2026-09-10')).toBe(true); // quinta: Pedro bloqueado
    expect(diasDeFolga.has('2026-09-09')).toBe(false); // quarta: todo mundo trabalha
    expect(linhas).toContain('10 · Pedro de folga');
    // Domingo ninguém trabalha: é loja fechada, não folga de cada um.
    expect(linhas).toContain('Fechado aos domingos');
    expect(linhas).toContain('Tiago não trabalha às segundas');
    expect(linhas.some((l) => l.startsWith('Pedro não trabalha'))).toBe(false);
    expect(linhas.filter((l) => l.startsWith('Tiago'))).toHaveLength(1);
  });

  it('quem folga mais dias do que trabalha é descrito pelos dias em que trabalha', () => {
    const soQuarta: Expediente[] = [
      ...EXPEDIENTES.filter((e) => e.staffId === 'pedro'),
      { staffId: 'tiago', weekday: 3, startTime: '09:00:00', endTime: '18:00:00' },
    ];
    const { linhas } = resumoDoMes(2026, 9, TZ, [PEDRO, TIAGO], soQuarta, []);
    expect(linhas).toContain('Tiago trabalha só às quartas');
  });

  it('domingo fechado fica fora das folgas e entra nos dias fechados', () => {
    const { diasDeFolga, diasFechados } = resumoDoMes(2026, 9, TZ, [PEDRO, TIAGO], EXPEDIENTES, []);
    expect(diasFechados.has('2026-09-13')).toBe(true);
    expect(diasDeFolga.has('2026-09-13')).toBe(false);
  });

  it('todos de folga num dia em que a loja abriria vira "Fechado" daquele dia', () => {
    const feriado = [
      { staffId: 'pedro', startAt: em('2026-09-09', '00:00'), endAt: em('2026-09-09', '23:59') },
      { staffId: 'tiago', startAt: em('2026-09-09', '00:00'), endAt: em('2026-09-09', '23:59') },
    ];
    const { diasFechados, linhas } = resumoDoMes(2026, 9, TZ, [PEDRO, TIAGO], EXPEDIENTES, feriado);
    expect(diasFechados.has('2026-09-09')).toBe(true);
    expect(linhas).toContain('9 · Fechado');
  });
});
