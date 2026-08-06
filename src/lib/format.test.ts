import { describe, it, expect } from 'vitest';
import { formatPrice, formatDuration, formatTime, formatDayLabel } from './format';

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
});

describe('formatDayLabel', () => {
  it('rotula o dia em pt-BR', () => {
    expect(formatDayLabel('2026-09-07', 'America/Sao_Paulo')).toMatch(/seg/i);
    expect(formatDayLabel('2026-09-07', 'America/Sao_Paulo')).toMatch(/7/);
  });
});
