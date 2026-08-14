import { describe, it, expect } from 'vitest';
import { conferirChaveDoBrain } from './guarda';

describe('conferirChaveDoBrain', () => {
  const chave = 'segredo-do-brain-com-mais-de-16-chars';

  it('aceita a chave exata', () => {
    expect(conferirChaveDoBrain(chave, chave)).toBe(true);
  });

  it('recusa chave errada do mesmo tamanho', () => {
    const errada = 'x'.repeat(chave.length);
    expect(conferirChaveDoBrain(errada, chave)).toBe(false);
  });

  it('recusa chave de tamanho diferente', () => {
    expect(conferirChaveDoBrain(`${chave}a`, chave)).toBe(false);
  });

  it('recusa header ausente', () => {
    expect(conferirChaveDoBrain(null, chave)).toBe(false);
    expect(conferirChaveDoBrain(undefined, chave)).toBe(false);
  });

  it('falha fechada quando não há chave configurada', () => {
    expect(conferirChaveDoBrain(chave, undefined)).toBe(false);
    expect(conferirChaveDoBrain('', undefined)).toBe(false);
  });
});
