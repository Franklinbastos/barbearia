import { describe, it, expect } from 'vitest';
import { validateShopSettings, MATIZES_PERMITIDOS } from './shop-settings';

const valido = {
  name: 'Barbearia Teste',
  slotMinutes: '30',
  minLeadMinutes: '60',
  maxAdvanceDays: '30',
  timeZone: 'America/Sao_Paulo',
};

describe('validateShopSettings', () => {
  it('aceita configuração válida', () => {
    expect(validateShopSettings(valido).slotMinutes).toBe(30);
  });

  it('aceita grade de 15 e de 60 minutos', () => {
    expect(validateShopSettings({ ...valido, slotMinutes: '15' }).slotMinutes).toBe(15);
    expect(validateShopSettings({ ...valido, slotMinutes: '60' }).slotMinutes).toBe(60);
  });

  it('recusa grade fora das opções', () => {
    expect(() => validateShopSettings({ ...valido, slotMinutes: '7' })).toThrow(/grade/i);
  });

  it('recusa antecedência negativa', () => {
    expect(() => validateShopSettings({ ...valido, minLeadMinutes: '-5' })).toThrow(/antecedência/i);
  });

  it('recusa janela de agendamento acima de um ano', () => {
    expect(() => validateShopSettings({ ...valido, maxAdvanceDays: '400' })).toThrow(/janela/i);
  });

  it('recusa fuso inexistente', () => {
    expect(() => validateShopSettings({ ...valido, timeZone: 'Marte/Olimpo' })).toThrow(/fuso/i);
  });

  it('aceita os 12 matizes da paleta', () => {
    expect(validateShopSettings({ ...valido, accentHue: '210' }).accentHue).toBe(210);
  });

  it('aceita ausência de matiz — o padrão é preto', () => {
    expect(validateShopSettings({ ...valido, accentHue: '' }).accentHue).toBeNull();
  });

  it('recusa matiz fora da paleta', () => {
    expect(() => validateShopSettings({ ...valido, accentHue: '77' })).toThrow(/cor/i);
  });

  it('a paleta tem exatamente doze matizes e todos passam', () => {
    expect(MATIZES_PERMITIDOS).toHaveLength(12);
    for (const matiz of MATIZES_PERMITIDOS) {
      expect(validateShopSettings({ ...valido, accentHue: String(matiz) }).accentHue).toBe(matiz);
    }
  });

  it('sem o campo no formulário o matiz continua nulo, não vira erro', () => {
    expect(validateShopSettings(valido).accentHue).toBeNull();
  });
});
