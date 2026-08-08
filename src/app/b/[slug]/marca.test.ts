import { describe, it, expect } from 'vitest';
import { estiloDaMarca } from './marca';

/**
 * A §3.4 trava L e croma de propósito: o dono escolhe UM número (o matiz) e
 * nenhuma escolha dele pode produzir botão ilegível. Croma 0.09 foi escolhido
 * por caber no sRGB em todo o círculo — 0.115 estoura em 21 dos 36 matizes.
 */
describe('estiloDaMarca', () => {
  it('sem matiz escolhido, não injeta nada — a página fica preto e branco', () => {
    expect(estiloDaMarca(null)).toBeUndefined();
  });

  it('monta as três variáveis a partir do matiz', () => {
    const e = estiloDaMarca(210) as Record<string, string>;
    expect(e['--marca']).toBe('oklch(0.45 0.09 210)');
    expect(e['--marca-suave']).toBe('oklch(0.955 0.025 210)');
    expect(e['--sobre-marca']).toBe('#FFFFFF');
  });

  it('trava o croma em 0.09 para qualquer matiz', () => {
    for (const h of [0, 90, 180, 270, 359]) {
      expect((estiloDaMarca(h) as Record<string, string>)['--marca']).toContain('0.09');
    }
  });

  it('recusa matiz fora de 0 a 360 em vez de gerar cor inválida', () => {
    expect(estiloDaMarca(-1)).toBeUndefined();
    expect(estiloDaMarca(400)).toBeUndefined();
    expect(estiloDaMarca(Number.NaN)).toBeUndefined();
  });
});
