import { describe, it, expect } from 'vitest';
import { computeAvailability, parseTimeToMinutes } from './compute';
import type { AvailabilityInput } from './types';

const BASE: AvailabilityInput = {
  date: '2026-09-01',
  timeZone: 'America/Sao_Paulo',
  slotMinutes: 30,
  minLeadMinutes: 0,
  serviceDurationMinutes: 30,
  workingBlocks: [{ startMinute: 9 * 60, endMinute: 12 * 60 }],
  busy: [],
  now: new Date('2026-08-01T00:00:00Z'),
};

function horarios(slots: { start: Date }[], timeZone = 'America/Sao_Paulo') {
  return slots.map((s) =>
    s.start.toLocaleTimeString('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit' }),
  );
}

describe('parseTimeToMinutes', () => {
  it('converte hora com segundos', () => {
    expect(parseTimeToMinutes('09:30:00')).toBe(570);
  });

  it('converte hora sem segundos', () => {
    expect(parseTimeToMinutes('14:00')).toBe(840);
  });
});

describe('computeAvailability — grade', () => {
  it('gera um slot por intervalo quando serviço e grade têm a mesma duração', () => {
    const slots = computeAvailability(BASE);
    expect(horarios(slots)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30']);
  });

  it('ocupa dois slots quando o serviço é maior que a grade', () => {
    const slots = computeAvailability({ ...BASE, serviceDurationMinutes: 45 });
    expect(horarios(slots)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00']);
    expect(slots[0].end.getTime() - slots[0].start.getTime()).toBe(60 * 60 * 1000);
  });

  it('descarta o candidato que não cabe no fim do bloco', () => {
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 60,
      workingBlocks: [{ startMinute: 9 * 60, endMinute: 10 * 60 }],
    });
    expect(horarios(slots)).toEqual(['09:00']);
  });

  it('não emenda dois blocos por cima do intervalo de almoço', () => {
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 60,
      workingBlocks: [
        { startMinute: 11 * 60, endMinute: 12 * 60 },
        { startMinute: 13 * 60, endMinute: 14 * 60 },
      ],
    });
    expect(horarios(slots)).toEqual(['11:00', '13:00']);
  });

  it('devolve lista vazia quando o barbeiro não trabalha no dia', () => {
    expect(computeAvailability({ ...BASE, workingBlocks: [] })).toEqual([]);
  });

  it('recusa slotMinutes inválido', () => {
    expect(() => computeAvailability({ ...BASE, slotMinutes: 0 })).toThrow(/slotMinutes/);
  });

  it('recusa duração de serviço inválida', () => {
    expect(() => computeAvailability({ ...BASE, serviceDurationMinutes: 0 })).toThrow(/duração/i);
  });
});

describe('computeAvailability — colisões', () => {
  it('remove os horários cobertos por um agendamento existente', () => {
    const slots = computeAvailability({
      ...BASE,
      busy: [{ start: new Date('2026-09-01T13:00:00Z'), end: new Date('2026-09-01T13:30:00Z') }],
    });
    expect(horarios(slots)).toEqual(['09:00', '09:30', '10:30', '11:00', '11:30']);
  });

  it('remove os horários cobertos por um bloqueio parcial no meio do dia', () => {
    const slots = computeAvailability({
      ...BASE,
      busy: [{ start: new Date('2026-09-01T13:15:00Z'), end: new Date('2026-09-01T14:15:00Z') }],
    });
    expect(horarios(slots)).toEqual(['09:00', '09:30', '11:30']);
  });

  it('remove os horários que um serviço longo atravessaria', () => {
    const slots = computeAvailability({
      ...BASE,
      serviceDurationMinutes: 60,
      busy: [{ start: new Date('2026-09-01T14:00:00Z'), end: new Date('2026-09-01T14:30:00Z') }],
    });
    expect(horarios(slots)).toEqual(['09:00', '09:30', '10:00']);
  });

  it('devolve lista vazia quando o dia está inteiramente ocupado', () => {
    const slots = computeAvailability({
      ...BASE,
      busy: [{ start: new Date('2026-09-01T12:00:00Z'), end: new Date('2026-09-01T15:00:00Z') }],
    });
    expect(slots).toEqual([]);
  });
});

describe('computeAvailability — antecedência mínima', () => {
  it('corta os horários que estão dentro da antecedência mínima', () => {
    const slots = computeAvailability({
      ...BASE,
      now: new Date('2026-09-01T12:40:00Z'),
      minLeadMinutes: 60,
    });
    expect(horarios(slots)).toEqual(['11:00', '11:30']);
  });

  it('não oferece horário no passado mesmo com antecedência zero', () => {
    const slots = computeAvailability({ ...BASE, now: new Date('2026-09-01T14:00:00Z') });
    expect(horarios(slots)).toEqual(['11:00', '11:30']);
  });
});

describe('computeAvailability — fuso e horário de verão', () => {
  it('respeita o horário local, não o do servidor', () => {
    const slots = computeAvailability({
      ...BASE,
      timeZone: 'America/Manaus',
      workingBlocks: [{ startMinute: 9 * 60, endMinute: 10 * 60 }],
    });
    expect(slots[0].start.toISOString()).toBe('2026-09-01T13:00:00.000Z');
  });

  it('não oferece horário que não existe no dia em que o relógio adianta', () => {
    const slots = computeAvailability({
      ...BASE,
      date: '2026-03-08',
      timeZone: 'America/New_York',
      workingBlocks: [{ startMinute: 1 * 60, endMinute: 5 * 60 }],
      now: new Date('2026-01-01T00:00:00Z'),
    });
    const locais = horarios(slots, 'America/New_York');
    expect(locais).not.toContain('02:00');
    expect(locais).not.toContain('02:30');
    expect(locais).toContain('01:00');
    expect(locais).toContain('03:00');
  });

  it('mantém a grade coerente no dia em que o relógio atrasa', () => {
    const slots = computeAvailability({
      ...BASE,
      date: '2026-11-01',
      timeZone: 'America/New_York',
      workingBlocks: [{ startMinute: 1 * 60, endMinute: 3 * 60 }],
      now: new Date('2026-01-01T00:00:00Z'),
    });
    const instantes = slots.map((s) => s.start.getTime());
    expect(new Set(instantes).size).toBe(instantes.length);
    expect(instantes).toEqual([...instantes].sort((a, b) => a - b));
  });
});
