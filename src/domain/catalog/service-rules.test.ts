import { describe, it, expect } from 'vitest';
import { validateServiceInput, parsePriceToCents } from './service-rules';

describe('parsePriceToCents', () => {
  it('aceita inteiro', () => expect(parsePriceToCents('40')).toBe(4000));
  it('aceita centavos com vírgula', () => expect(parsePriceToCents('40,50')).toBe(4050));
  it('aceita com prefixo e espaço', () => expect(parsePriceToCents('R$ 40,50')).toBe(4050));
  it('aceita zero', () => expect(parsePriceToCents('0')).toBe(0));
  it('recusa texto sem número', () => expect(() => parsePriceToCents('abc')).toThrow(/preço/i));
  it('recusa negativo', () => expect(() => parsePriceToCents('-10')).toThrow(/preço/i));
});

describe('validateServiceInput', () => {
  const valido = { name: 'Corte', durationMinutes: '30', priceCents: '40' };

  it('aceita entrada válida', () => {
    expect(validateServiceInput(valido, 30)).toEqual({ name: 'Corte', durationMinutes: 30, priceCents: 4000 });
  });

  it('aceita duração que não é múltiplo da grade', () => {
    expect(validateServiceInput({ ...valido, durationMinutes: '45' }, 30).durationMinutes).toBe(45);
  });

  it('recusa nome vazio', () => {
    expect(() => validateServiceInput({ ...valido, name: ' ' }, 30)).toThrow(/nome/i);
  });

  it('recusa duração zero', () => {
    expect(() => validateServiceInput({ ...valido, durationMinutes: '0' }, 30)).toThrow(/duração/i);
  });

  it('recusa duração acima de 8 horas', () => {
    expect(() => validateServiceInput({ ...valido, durationMinutes: '600' }, 30)).toThrow(/duração/i);
  });
});
