import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Db } from '@/db/repositories';
import type { LojaDoBrain, ServicoDoBrain, BarbeiroDoBrain } from './tipos';

vi.mock('@/domain/booking', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/domain/booking')>()),
  createAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
  rescheduleAppointment: vi.fn(),
}));

import {
  createAppointment,
  cancelAppointment,
  rescheduleAppointment,
  SlotTakenError,
  NotFoundError,
} from '@/domain/booking';
import { executar } from './executar';

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

const criar = vi.mocked(createAppointment);
const cancelar = vi.mocked(cancelAppointment);
const remarcar = vi.mocked(rescheduleAppointment);

const payloadValido = {
  serviceName: 'Corte',
  sessionDate: '2026-08-20',
  sessionTime: '09:00',
  clientName: 'Bruno',
  customerPhone: '11999998888',
};

beforeEach(() => {
  criar.mockReset();
  cancelar.mockReset();
  remarcar.mockReset();
});

describe('executar — marcar', () => {
  it('cria o agendamento com origin BOT e ids mapeados', async () => {
    criar.mockResolvedValue({
      appointmentId: 'ap1',
      staffId: 'b1',
      startAt: new Date('2026-08-20T12:00:00Z'),
      endAt: new Date('2026-08-20T12:30:00Z'),
    });

    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'marcar_horario',
      idempotencyKey: 'k1',
      payload: payloadValido,
    });

    expect(r.status).toBe('SUCCEEDED');
    expect(r.summary).toContain('João');
    expect(criar).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        barbershopId: 'loja-1',
        serviceId: 's1',
        origin: 'BOT',
        customer: { name: 'Bruno', phone: '11999998888' },
      }),
    );
  });

  it('recusa sem nome/telefone do cliente', async () => {
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'marcar_horario',
      idempotencyKey: 'k1',
      payload: { ...payloadValido, customerPhone: '' },
    });
    expect(r.status).toBe('REJECTED');
    expect(r.code).toBe('MISSING_CUSTOMER');
    expect(criar).not.toHaveBeenCalled();
  });

  it('recusa serviço desconhecido', async () => {
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'marcar_horario',
      idempotencyKey: 'k1',
      payload: { ...payloadValido, serviceName: 'Sobrancelha' },
    });
    expect(r.code).toBe('SERVICE_NOT_FOUND');
  });

  it('recusa data/horário inválidos', async () => {
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'marcar_horario',
      idempotencyKey: 'k1',
      payload: { ...payloadValido, sessionDate: 'xx' },
    });
    expect(r.code).toBe('INVALID_DATETIME');
  });

  it('traduz erro de negócio (horário tomado) em REJECTED', async () => {
    criar.mockRejectedValue(new SlotTakenError());
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'marcar_horario',
      idempotencyKey: 'k1',
      payload: payloadValido,
    });
    expect(r.status).toBe('REJECTED');
    expect(r.code).toBe('SLOT_TAKEN');
  });

  it('deixa erro inesperado subir', async () => {
    criar.mockRejectedValue(new Error('conexão caiu'));
    await expect(
      executar(db, loja, servicos, equipe, {
        actionName: 'marcar_horario',
        idempotencyKey: 'k1',
        payload: payloadValido,
      }),
    ).rejects.toThrow('conexão caiu');
  });
});

describe('executar — cancelar', () => {
  it('cancela reusando cancelAppointment com origem CUSTOMER', async () => {
    cancelar.mockResolvedValue(undefined);
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'cancelar_horario',
      idempotencyKey: 'k2',
      payload: { appointmentId: 'ap1' },
    });
    expect(r.status).toBe('SUCCEEDED');
    expect(cancelar).toHaveBeenCalledWith(db, 'loja-1', 'ap1', { origin: 'CUSTOMER' });
  });

  it('aceita o id via externalReference', async () => {
    cancelar.mockResolvedValue(undefined);
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'cancelar_horario',
      idempotencyKey: 'k2',
      externalReference: 'ap9',
      payload: {},
    });
    expect(r.status).toBe('SUCCEEDED');
    expect(cancelar).toHaveBeenCalledWith(db, 'loja-1', 'ap9', { origin: 'CUSTOMER' });
  });

  it('recusa sem id do agendamento', async () => {
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'cancelar_horario',
      idempotencyKey: 'k2',
      payload: {},
    });
    expect(r.code).toBe('MISSING_APPOINTMENT');
    expect(cancelar).not.toHaveBeenCalled();
  });

  it('traduz agendamento inexistente em REJECTED', async () => {
    cancelar.mockRejectedValue(new NotFoundError('Agendamento não encontrado'));
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'cancelar_horario',
      idempotencyKey: 'k2',
      payload: { appointmentId: 'ap1' },
    });
    expect(r.status).toBe('REJECTED');
    expect(r.code).toBe('NOT_FOUND');
  });
});

describe('executar — remarcar', () => {
  const alvo = {
    appointmentId: 'ap1',
    sessionDate: '2026-08-20',
    sessionTime: '15:00',
    staffName: 'João',
  };

  it('remarca reusando rescheduleAppointment com o novo início e barbeiro', async () => {
    remarcar.mockResolvedValue(undefined);
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'remarcar_horario',
      idempotencyKey: 'k3',
      payload: alvo,
    });
    expect(r.status).toBe('SUCCEEDED');
    expect(remarcar).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        appointmentId: 'ap1',
        barbershopId: 'loja-1',
        novoStaffId: 'b1',
        avisarCliente: false,
      }),
    );
    // o novoInicio é a data+hora local convertidas (15:00 America/Sao_Paulo = 18:00Z)
    expect(remarcar.mock.calls[0][1].novoInicio.toISOString()).toBe('2026-08-20T18:00:00.000Z');
  });

  it('mantém o barbeiro quando staffName não vem (só muda a hora)', async () => {
    remarcar.mockResolvedValue(undefined);
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'remarcar_horario',
      idempotencyKey: 'k3',
      payload: { appointmentId: 'ap1', sessionDate: '2026-08-20', sessionTime: '16:00' },
    });
    expect(r.status).toBe('SUCCEEDED');
    expect(remarcar.mock.calls[0][1].novoStaffId).toBeUndefined();
  });

  it('aceita o id do alvo via externalReference', async () => {
    remarcar.mockResolvedValue(undefined);
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'remarcar_horario',
      idempotencyKey: 'k3',
      externalReference: 'ap9',
      payload: { sessionDate: '2026-08-20', sessionTime: '16:00' },
    });
    expect(r.status).toBe('SUCCEEDED');
    expect(remarcar.mock.calls[0][1].appointmentId).toBe('ap9');
  });

  it('recusa sem id do agendamento-alvo', async () => {
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'remarcar_horario',
      idempotencyKey: 'k3',
      payload: { sessionDate: '2026-08-20', sessionTime: '16:00' },
    });
    expect(r.code).toBe('MISSING_APPOINTMENT');
    expect(remarcar).not.toHaveBeenCalled();
  });

  it('recusa data/horário inválidos', async () => {
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'remarcar_horario',
      idempotencyKey: 'k3',
      payload: { appointmentId: 'ap1', sessionDate: 'xx', sessionTime: '16:00' },
    });
    expect(r.code).toBe('INVALID_DATETIME');
    expect(remarcar).not.toHaveBeenCalled();
  });

  it('traduz colisão de horário (SlotTaken) em REJECTED', async () => {
    remarcar.mockRejectedValue(new SlotTakenError());
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'remarcar_horario',
      idempotencyKey: 'k3',
      payload: alvo,
    });
    expect(r.status).toBe('REJECTED');
    expect(r.code).toBe('SLOT_TAKEN');
  });

  it('traduz agendamento inexistente em REJECTED', async () => {
    remarcar.mockRejectedValue(new NotFoundError('Agendamento não encontrado'));
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'remarcar_horario',
      idempotencyKey: 'k3',
      payload: alvo,
    });
    expect(r.code).toBe('NOT_FOUND');
  });
});

describe('executar — guardas de envelope', () => {
  it('recusa sem idempotencyKey', async () => {
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'marcar_horario',
      idempotencyKey: '',
      payload: payloadValido,
    });
    expect(r.code).toBe('MISSING_IDEMPOTENCY_KEY');
  });

  it('recusa operação desconhecida', async () => {
    const r = await executar(db, loja, servicos, equipe, {
      actionName: 'fazer_cafe',
      idempotencyKey: 'k1',
      payload: {},
    });
    expect(r.code).toBe('UNKNOWN_ACTION');
  });
});
