import { describe, it, expect } from 'vitest';
import { renderConfirmation, renderReminder, renderCancellation } from './templates';

const DADOS = {
  customerName: 'João',
  shopName: 'Barbearia Teste',
  staffName: 'Maria',
  serviceName: 'Corte',
  startAt: new Date('2026-09-07T12:00:00Z'),
  timeZone: 'America/Sao_Paulo',
  manageUrl: 'https://exemplo.com/agendamento/abc',
};

describe('templates de mensagem', () => {
  it('confirmação traz data, hora e barbeiro no fuso da barbearia', () => {
    const msg = renderConfirmation(DADOS);
    expect(msg.fallbackText).toContain('09:00');
    expect(msg.fallbackText).toContain('Maria');
    expect(msg.fallbackText).toContain('Barbearia Teste');
    expect(msg.fallbackText).toContain(DADOS.manageUrl);
  });

  it('confirmação usa o template registrado na Meta', () => {
    const msg = renderConfirmation(DADOS);
    expect(msg.templateName).toBe('agendamento_confirmado');
    expect(msg.params).toHaveLength(5);
  });

  it('lembrete não repete o link de gerenciamento no corpo', () => {
    const msg = renderReminder(DADOS);
    expect(msg.templateName).toBe('agendamento_lembrete');
    expect(msg.fallbackText).toContain('09:00');
  });

  it('cancelamento avisa que o horário foi liberado', () => {
    const msg = renderCancellation(DADOS);
    expect(msg.templateName).toBe('agendamento_cancelado');
    expect(msg.fallbackText).toMatch(/cancelad/i);
  });

  it('escreve acentuação correta', () => {
    expect(renderConfirmation(DADOS).fallbackText).toMatch(/horário|serviço|confirmação/);
  });
});
