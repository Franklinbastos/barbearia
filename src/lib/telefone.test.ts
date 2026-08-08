import { describe, it, expect } from 'vitest';
import { aplicarMascaraTelefone } from './telefone';

describe('aplicarMascaraTelefone', () => {
  it('formata celular com 11 dígitos', () => {
    expect(aplicarMascaraTelefone('11999998888')).toBe('(11) 99999-8888');
  });
  it('formata fixo com 10 dígitos', () => {
    expect(aplicarMascaraTelefone('1133334444')).toBe('(11) 3333-4444');
  });
  it('formata parcial enquanto digita', () => {
    expect(aplicarMascaraTelefone('11')).toBe('(11');
    expect(aplicarMascaraTelefone('119')).toBe('(11) 9');
  });
  it('ignora o que não é dígito', () => {
    expect(aplicarMascaraTelefone('(11) 99999-8888')).toBe('(11) 99999-8888');
  });
  it('não passa de 11 dígitos', () => {
    expect(aplicarMascaraTelefone('119999988889999')).toBe('(11) 99999-8888');
  });
  it('devolve vazio para vazio', () => {
    expect(aplicarMascaraTelefone('')).toBe('');
  });
});
