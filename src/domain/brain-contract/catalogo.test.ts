import { describe, it, expect } from 'vitest';
import { montarCatalogo, OP_MARCAR, OP_CANCELAR } from './catalogo';
import type { LojaDoBrain, ServicoDoBrain, BarbeiroDoBrain } from './tipos';

const loja: LojaDoBrain = {
  id: 'loja-1',
  slug: 'barbearia-teste',
  name: 'Barbearia do Zé',
  timeZone: 'America/Sao_Paulo',
  maxAdvanceDays: 30,
};

const servicos: ServicoDoBrain[] = [
  { id: 's1', name: 'Corte', durationMinutes: 30, priceCents: 4000 },
  { id: 's2', name: 'Barba', durationMinutes: 20, priceCents: 2500 },
];

const equipe: BarbeiroDoBrain[] = [
  { id: 'b1', name: 'João' },
  { id: 'b2', name: 'Pedro' },
];

describe('montarCatalogo', () => {
  it('declara as duas operações', () => {
    const cat = montarCatalogo(loja, servicos, equipe);
    expect(cat.operations).toEqual([OP_MARCAR, OP_CANCELAR]);
  });

  it('monta os slots de marcar com serviço, profissional, data e horário', () => {
    const cat = montarCatalogo(loja, servicos, equipe);
    const nomes = cat.intentSlots[OP_MARCAR].map((s) => s.name);
    expect(nomes).toEqual(['serviceName', 'staffName', 'sessionDate', 'sessionTime']);
  });

  it('embute os serviços e a equipe reais da barbearia', () => {
    const cat = montarCatalogo(loja, servicos, equipe);
    const servico = cat.intentSlots[OP_MARCAR].find((s) => s.name === 'serviceName')!;
    const staff = cat.intentSlots[OP_MARCAR].find((s) => s.name === 'staffName')!;
    expect(servico.values).toEqual(['Corte', 'Barba']);
    expect(servico.hint).toContain('Corte');
    expect(staff.values).toEqual(['João', 'Pedro']);
  });

  it('põe o nome da loja e o preço dos serviços no menu de conversa', () => {
    const cat = montarCatalogo(loja, servicos, equipe);
    expect(cat.conversationMenu?.offerText).toContain('Barbearia do Zé');
    const info = cat.conversationMenu?.intents?.find((i) => i.name === 'lista_de_servicos');
    expect(info?.replyText).toContain('Corte');
    expect(info?.replyText).toContain('40,00');
  });

  it('marca as duas operações no menu com operação inversa', () => {
    const cat = montarCatalogo(loja, servicos, equipe);
    expect(cat.uxHints?.[OP_MARCAR]?.inverseOperation).toBe(OP_CANCELAR);
    expect(cat.uxHints?.[OP_CANCELAR]?.inverseOperation).toBe(OP_MARCAR);
  });

  it('aguenta loja sem serviços nem equipe', () => {
    const cat = montarCatalogo(loja, [], []);
    const servico = cat.intentSlots[OP_MARCAR].find((s) => s.name === 'serviceName')!;
    expect(servico.values).toEqual([]);
    expect(cat.conversationMenu?.intents?.find((i) => i.name === 'lista_de_servicos')?.replyText)
      .toContain('Ainda não temos serviços');
  });
});
