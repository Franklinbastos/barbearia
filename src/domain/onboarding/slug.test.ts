import { describe, it, expect } from 'vitest';
import { normalizeSlug } from './create-barbershop';

describe('normalizeSlug', () => {
  it('minúsculas e hífens', () => {
    expect(normalizeSlug('Barbearia do João')).toBe('barbearia-do-joao');
  });

  it('remove acentos e cedilha', () => {
    expect(normalizeSlug('Ação & Estilo')).toBe('acao-estilo');
  });

  it('colapsa separadores repetidos e apara as pontas', () => {
    expect(normalizeSlug('  --Corte   Rápido--  ')).toBe('corte-rapido');
  });

  it('recusa entrada que não sobra nada', () => {
    expect(() => normalizeSlug('###')).toThrow(/slug/i);
  });

  it('recusa slug reservado', () => {
    expect(() => normalizeSlug('app')).toThrow(/reservado/i);
  });
});
