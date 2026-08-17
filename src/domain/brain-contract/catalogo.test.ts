import { describe, it, expect } from 'vitest';
import { montarCatalogo, resumirExpediente, OP_MARCAR, OP_CANCELAR } from './catalogo';
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

  it('monta os slots de marcar com serviço, profissional, data, horário e nome', () => {
    const cat = montarCatalogo(loja, servicos, equipe);
    const nomes = cat.intentSlots[OP_MARCAR].map((s) => s.name);
    expect(nomes).toEqual(['serviceName', 'staffName', 'sessionDate', 'sessionTime', 'clientName']);
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

  it('resume o expediente da loja em faixa de dias e horário', () => {
    const resumo = resumirExpediente([
      { weekday: 1, startTime: '09:00:00', endTime: '18:00:00' },
      { weekday: 2, startTime: '09:00:00', endTime: '18:00:00' },
      { weekday: 3, startTime: '09:00:00', endTime: '18:00:00' },
      { weekday: 4, startTime: '09:00:00', endTime: '18:00:00' },
      { weekday: 5, startTime: '09:00:00', endTime: '18:00:00' },
      { weekday: 6, startTime: '09:00:00', endTime: '18:00:00' },
    ]);
    expect(resumo).toBe('Atendemos de segunda a sábado, das 09:00 às 18:00. Fechado domingo.');
  });

  it('sem expediente, avisa que não está cadastrado', () => {
    expect(resumirExpediente([])).toContain('não está cadastrado');
  });

  it('adiciona o intent de horário de funcionamento no menu quando há expediente', () => {
    const cat = montarCatalogo(loja, servicos, equipe, [
      { weekday: 1, startTime: '09:00:00', endTime: '18:00:00' },
      { weekday: 2, startTime: '09:00:00', endTime: '18:00:00' },
      { weekday: 3, startTime: '09:00:00', endTime: '18:00:00' },
    ]);
    const faq = cat.conversationMenu?.intents?.find((i) => i.name === 'horario_funcionamento');
    expect(faq?.behavior).toBe('INFO');
    expect(faq?.replyText).toContain('09:00');
  });

  it('sem expediente, não adiciona o intent de horário', () => {
    const cat = montarCatalogo(loja, servicos, equipe);
    const faq = cat.conversationMenu?.intents?.find((i) => i.name === 'horario_funcionamento');
    expect(faq).toBeUndefined();
  });

  it('adiciona o intent de despedida no menu, com copy fixa que encerra sem re-saudar', () => {
    const cat = montarCatalogo(loja, servicos, equipe);
    const despedida = cat.conversationMenu?.intents?.find((i) => i.name === 'despedida');
    expect(despedida?.behavior).toBe('INFO');
    expect(despedida?.replyText).toContain('chamar');
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
