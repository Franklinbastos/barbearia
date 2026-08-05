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
