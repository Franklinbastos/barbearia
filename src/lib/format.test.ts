import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  formatPrice,
  formatDuration,
  formatTime,
  formatDayLabel,
  isoDateInZone,
  formatDayLabelFromInstant,
  formatDateTime,
  formatAppointmentStatus,
} from './format';

describe('formatPrice', () => {
  it('formata reais e centavos', () => expect(formatPrice(4050)).toBe('R$ 40,50'));
  it('formata valor redondo', () => expect(formatPrice(4000)).toBe('R$ 40,00'));
  it('formata gratuito', () => expect(formatPrice(0)).toBe('Grátis'));
});

describe('formatDuration', () => {
  it('minutos', () => expect(formatDuration(45)).toBe('45 min'));
  it('hora exata', () => expect(formatDuration(60)).toBe('1 h'));
  it('hora e minutos', () => expect(formatDuration(90)).toBe('1 h 30 min'));
});

describe('formatTime', () => {
  it('mostra a hora no fuso da barbearia', () => {
    expect(formatTime('2026-09-07T12:00:00.000Z', 'America/Sao_Paulo')).toBe('09:00');
  });

  it('aceita Date — é o que vem do banco na agenda do painel', () => {
    expect(formatTime(new Date('2026-09-07T12:00:00.000Z'), 'America/Sao_Paulo')).toBe('09:00');
  });

  it('não usa o fuso da máquina', () => {
    const tzOriginal = process.env.TZ;
    process.env.TZ = 'UTC';
    try {
      expect(formatTime(new Date('2026-09-08T00:30:00.000Z'), 'America/Sao_Paulo')).toBe('21:30');
    } finally {
      process.env.TZ = tzOriginal;
    }
  });
});

describe('formatDayLabel', () => {
  it('rotula o dia em pt-BR', () => {
    expect(formatDayLabel('2026-09-07', 'America/Sao_Paulo')).toMatch(/seg/i);
    expect(formatDayLabel('2026-09-07', 'America/Sao_Paulo')).toMatch(/7/);
  });
});

describe('isoDateInZone', () => {
  it('devolve o dia do fuso da barbearia, não o dia em UTC', () => {
    // 21:30 de 7/9 em São Paulo já é 8/9 em UTC.
    expect(isoDateInZone('2026-09-08T00:30:00.000Z', 'America/Sao_Paulo')).toBe('2026-09-07');
  });

  it('aceita Date além de string', () => {
    expect(isoDateInZone(new Date('2026-09-08T00:30:00.000Z'), 'America/Sao_Paulo')).toBe('2026-09-07');
  });

  it('não é o mesmo que cortar os 10 primeiros caracteres do ISO', () => {
    const iso = '2026-09-08T00:30:00.000Z';
    expect(isoDateInZone(iso, 'America/Sao_Paulo')).not.toBe(iso.slice(0, 10));
  });

  it('funciona em fuso à frente de UTC', () => {
    expect(isoDateInZone('2026-09-07T23:00:00.000Z', 'Europe/Lisbon')).toBe('2026-09-08');
  });
});

describe('formatDayLabelFromInstant', () => {
  it('rotula o dia do instante no fuso da barbearia', () => {
    const rotulo = formatDayLabelFromInstant('2026-09-08T00:30:00.000Z', 'America/Sao_Paulo');
    expect(rotulo).toMatch(/seg/i);
    expect(rotulo).toContain('7 de set');
  });
});

describe('formatDateTime', () => {
  const tzOriginal = process.env.TZ;
  beforeAll(() => {
    // Simula o servidor da Vercel, que roda em UTC.
    process.env.TZ = 'UTC';
  });
  afterAll(() => {
    process.env.TZ = tzOriginal;
  });

  it('usa o fuso da barbearia mesmo com o servidor em UTC', () => {
    const instante = new Date('2026-09-08T00:30:00.000Z');
    expect(formatDateTime(instante, 'America/Sao_Paulo')).toBe('07/09/2026, 21:30');
  });

  it('aceita string ISO', () => {
    expect(formatDateTime('2026-09-08T00:30:00.000Z', 'America/Sao_Paulo')).toBe('07/09/2026, 21:30');
  });

  it('respeita um fuso diferente do da máquina', () => {
    expect(formatDateTime('2026-09-07T23:00:00.000Z', 'Europe/Lisbon')).toBe('08/09/2026, 00:00');
  });
});

describe('formatAppointmentStatus', () => {
  it('traduz os estados do agendamento para pt-BR', () => {
    expect(formatAppointmentStatus('BOOKED')).toBe('Agendado');
    expect(formatAppointmentStatus('DONE')).toBe('Compareceu');
    expect(formatAppointmentStatus('CANCELED')).toBe('Cancelado');
    expect(formatAppointmentStatus('NO_SHOW')).toBe('Não veio');
  });

  it('nunca devolve o enum cru do banco', () => {
    for (const status of ['BOOKED', 'DONE', 'CANCELED', 'NO_SHOW'] as const) {
      expect(formatAppointmentStatus(status)).not.toBe(status);
      expect(formatAppointmentStatus(status)).not.toMatch(/_/);
    }
  });
});
