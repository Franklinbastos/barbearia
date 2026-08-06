import { describe, it, expect } from 'vitest';
import { validateShopSettings } from './shop-settings';

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
});
