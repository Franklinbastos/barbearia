import { describe, it, expect } from 'vitest';
import { aplicarMascaraTelefone, telefoneParaWaMe } from './telefone';

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

describe('telefoneParaWaMe', () => {
  it('põe o 55 no número nacional, mascarado ou não', () => {
    // O link sem o 55 abre o WhatsApp em conversa vazia, e nada na tela avisa.
    expect(telefoneParaWaMe('(11) 99999-8888')).toBe('5511999998888');
    expect(telefoneParaWaMe('11999998888')).toBe('5511999998888');
  });
  it('aceita fixo de 10 dígitos', () => {
    expect(telefoneParaWaMe('(11) 3333-4444')).toBe('551133334444');
  });
  it('não repete o 55 de quem já veio com país', () => {
    expect(telefoneParaWaMe('5511999998888')).toBe('5511999998888');
  });
});
