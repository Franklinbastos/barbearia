import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Db } from '@/db/repositories';
import type { LojaDoBrain, ServicoDoBrain, BarbeiroDoBrain } from './tipos';

vi.mock('@/domain/booking', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/domain/booking')>()),
  getAvailability: vi.fn(),
}));
vi.mock('@/db/repositories', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/db/repositories')>()),
  findAppointmentById: vi.fn(),
}));

import { getAvailability, OutsideBookingWindowError } from '@/domain/booking';
import { findAppointmentById } from '@/db/repositories';
import { autorizar } from './autorizar';

const db = {} as unknown as Db;
const loja: LojaDoBrain = {
  id: 'loja-1',
  slug: 'barbearia-teste',
  name: 'Barbearia do Zé',
  timeZone: 'America/Sao_Paulo',
  maxAdvanceDays: 30,
};
const servicos: ServicoDoBrain[] = [{ id: 's1', name: 'Corte', durationMinutes: 30, priceCents: 4000 }];
const equipe: BarbeiroDoBrain[] = [{ id: 'b1', name: 'João' }];

const disponivel = vi.mocked(getAvailability);
const acharAgendamento = vi.mocked(findAppointmentById);
const AGORA = new Date('2026-08-19T10:00:00Z');

beforeEach(() => {
  disponivel.mockReset();
  acharAgendamento.mockReset();
});

describe('autorizar — marcar', () => {
  const pedido = {
    intent: 'marcar_horario',
    slots: { serviceName: 'Corte', sessionDate: '2026-08-20', sessionTime: '09:00' },
  };

  it('libera quando o horário está na grade', async () => {
    disponivel.mockResolvedValue([
      { staffId: 'b1', staffName: 'João', start: new Date('2026-08-20T12:00:00Z'), end: new Date('2026-08-20T12:30:00Z'), durationMinutes: 30 },
    ]);
    const r = await autorizar(db, loja, servicos, equipe, pedido, AGORA);
    expect(r.allowed).toBe(true);
  });

  it('recusa quando o horário não está na grade', async () => {
    disponivel.mockResolvedValue([
      { staffId: 'b1', staffName: 'João', start: new Date('2026-08-20T13:00:00Z'), end: new Date('2026-08-20T13:30:00Z'), durationMinutes: 30 },
    ]);
    const r = await autorizar(db, loja, servicos, equipe, pedido, AGORA);
    expect(r.allowed).toBe(false);
    expect(r.message).toMatch(/não está mais livre/i);
  });

  it('recusa serviço desconhecido sem ir à grade', async () => {
    const r = await autorizar(db, loja, servicos, equipe, { intent: 'marcar', slots: { serviceName: 'Sobrancelha', sessionDate: '2026-08-20', sessionTime: '09:00' } }, AGORA);
    expect(r.allowed).toBe(false);
    expect(disponivel).not.toHaveBeenCalled();
  });

  it('recusa com a mensagem do domínio quando o dia está fora da janela', async () => {
    disponivel.mockRejectedValue(new OutsideBookingWindowError('Esta barbearia agenda com até 7 dias'));
    const r = await autorizar(db, loja, servicos, equipe, pedido, AGORA);
    expect(r.allowed).toBe(false);
    expect(r.message).toMatch(/7 dias/);
  });

  it('recusa quando falta data ou horário', async () => {
    const r = await autorizar(db, loja, servicos, equipe, { intent: 'marcar', slots: { serviceName: 'Corte' } }, AGORA);
    expect(r.allowed).toBe(false);
  });
});

describe('autorizar — cancelar', () => {
  it('libera agendamento BOOKED no futuro', async () => {
    acharAgendamento.mockResolvedValue({ status: 'BOOKED', startAt: new Date('2026-08-20T12:00:00Z') } as never);
    const r = await autorizar(db, loja, servicos, equipe, { intent: 'cancelar_horario', slots: { appointmentId: 'a1' } }, AGORA);
    expect(r.allowed).toBe(true);
  });

  it('recusa quando não encontra o agendamento', async () => {
    acharAgendamento.mockResolvedValue(null as never);
    const r = await autorizar(db, loja, servicos, equipe, { intent: 'cancelar', slots: { appointmentId: 'a1' } }, AGORA);
    expect(r.allowed).toBe(false);
    expect(r.message).toMatch(/não encontrei/i);
  });

  it('recusa quando já começou', async () => {
    acharAgendamento.mockResolvedValue({ status: 'BOOKED', startAt: new Date('2026-08-19T09:00:00Z') } as never);
    const r = await autorizar(db, loja, servicos, equipe, { intent: 'cancelar', slots: { appointmentId: 'a1' } }, AGORA);
    expect(r.allowed).toBe(false);
    expect(r.message).toMatch(/já começou/i);
  });

  it('recusa atendimento já fechado pela barbearia', async () => {
    acharAgendamento.mockResolvedValue({ status: 'DONE', startAt: new Date('2026-08-20T12:00:00Z') } as never);
    const r = await autorizar(db, loja, servicos, equipe, { intent: 'cancelar', slots: { appointmentId: 'a1' } }, AGORA);
    expect(r.allowed).toBe(false);
  });

  it('recusa sem id do agendamento', async () => {
    const r = await autorizar(db, loja, servicos, equipe, { intent: 'cancelar', slots: {} }, AGORA);
    expect(r.allowed).toBe(false);
    expect(acharAgendamento).not.toHaveBeenCalled();
  });
});

describe('autorizar — intenção desconhecida', () => {
  it('recusa educadamente', async () => {
    const r = await autorizar(db, loja, servicos, equipe, { intent: 'pedir_cafe', slots: {} }, AGORA);
    expect(r.allowed).toBe(false);
  });
});
