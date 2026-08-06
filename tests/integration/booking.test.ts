import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff, service, staffService, workingHours, appointment } from '@/db/schema';
import { getAvailability, createAppointment, cancelAppointment, SlotUnavailableError } from '@/domain/booking';

const SEGUNDA = '2026-09-07'; // segunda-feira

async function semear(db: TestDb, opts: { duracao?: number; slot?: number } = {}) {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'teste', name: 'Teste', slotMinutes: opts.slot ?? 30, minLeadMinutes: 0 })
    .returning();
  const [joao] = await db.insert(staff).values({ barbershopId: loja.id, name: 'João', role: 'OWNER' }).returning();
  const [maria] = await db.insert(staff).values({ barbershopId: loja.id, name: 'Maria' }).returning();
  const [corte] = await db
    .insert(service)
    .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: opts.duracao ?? 30, priceCents: 4000 })
    .returning();
  await db.insert(staffService).values([
    { barbershopId: loja.id, staffId: joao.id, serviceId: corte.id },
    { barbershopId: loja.id, staffId: maria.id, serviceId: corte.id },
  ]);
  await db.insert(workingHours).values([
    { barbershopId: loja.id, staffId: joao.id, weekday: 1, startTime: '09:00:00', endTime: '11:00:00' },
    { barbershopId: loja.id, staffId: maria.id, weekday: 1, startTime: '09:00:00', endTime: '10:00:00' },
  ]);
  return { loja, joao, maria, corte };
}

const CLIENTE = { name: 'Cliente', phone: '11999998888' };

describe('getAvailability', () => {
  it('lista os horários de um barbeiro específico', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const slots = await getAvailability(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id, date: SEGUNDA,
      });
      expect(slots).toHaveLength(4);
      expect(slots[0].start.toISOString()).toBe('2026-09-07T12:00:00.000Z');
    });
  });

  it('agrega os horários de todos os barbeiros quando nenhum é escolhido', async () => {
    await withTestDb(async (db) => {
      const { loja, corte } = await semear(db);
      const slots = await getAvailability(db, { barbershopId: loja.id, serviceId: corte.id, date: SEGUNDA });
      const inicios = [...new Set(slots.map((s) => s.start.toISOString()))];
      expect(inicios).toHaveLength(4);
    });
  });

  it('usa a duração própria do barbeiro quando existe', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await db
        .update(staffService)
        .set({ durationMinutesOverride: 60 })
        .where(eq(staffService.staffId, joao.id));
      const slots = await getAvailability(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id, date: SEGUNDA,
      });
      expect(slots).toHaveLength(3);
    });
  });
});

describe('createAppointment', () => {
  it('cria o agendamento com snapshot do serviço', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
      expect(linha.serviceNameSnapshot).toBe('Corte');
      expect(linha.servicePriceCentsSnapshot).toBe(4000);
      expect(linha.serviceDurationMinutesSnapshot).toBe(30);
      expect(linha.endAt.toISOString()).toBe('2026-09-07T12:30:00.000Z');
    });
  });

  it('arredonda o fim para slots inteiros quando o serviço não fecha na grade', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db, { duracao: 45 });
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
      expect(linha.serviceDurationMinutesSnapshot).toBe(45);
      expect(linha.endAt.toISOString()).toBe('2026-09-07T13:00:00.000Z');
    });
  });

  it('recusa horário que não está na grade oferecida', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: new Date('2026-09-07T12:10:00Z'), customer: CLIENTE, origin: 'PUBLIC',
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);
    });
  });

  it('recusa horário fora do expediente', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await expect(
        createAppointment(db, {
          barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
          startAt: new Date('2026-09-07T20:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
        }),
      ).rejects.toBeInstanceOf(SlotUnavailableError);
    });
  });

  it('recusa o segundo agendamento no mesmo horário do mesmo barbeiro', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const args = {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC' as const,
      };
      await createAppointment(db, args);
      await expect(createAppointment(db, args)).rejects.toBeInstanceOf(SlotUnavailableError);
    });
  });

  it('escolhe um barbeiro livre no modo "qualquer"', async () => {
    await withTestDb(async (db) => {
      const { loja, corte, joao, maria } = await semear(db);
      const primeiro = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const segundo = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id,
        startAt: new Date('2026-09-07T12:00:00Z'),
        customer: { name: 'Outro', phone: '11977776666' }, origin: 'PUBLIC',
      });
      expect(new Set([primeiro.staffId, segundo.staffId])).toEqual(new Set([joao.id, maria.id]));
    });
  });

  it('reaproveita o cliente pelo telefone', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, maria, corte } = await semear(db);
      const a = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const b = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: maria.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const [linhaA] = await db.select().from(appointment).where(eq(appointment.id, a.appointmentId));
      const [linhaB] = await db.select().from(appointment).where(eq(appointment.id, b.appointmentId));
      expect(linhaA.customerId).toBe(linhaB.customerId);
    });
  });
});

describe('cancelAppointment', () => {
  it('libera o horário para um novo agendamento', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const args = {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC' as const,
      };
      const criado = await createAppointment(db, args);
      await cancelAppointment(db, loja.id, criado.appointmentId);
      const novo = await createAppointment(db, args);
      expect(novo.appointmentId).not.toBe(criado.appointmentId);
    });
  });

  it('não cancela agendamento de outra barbearia', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      const criado = await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'), customer: CLIENTE, origin: 'PUBLIC',
      });
      const [outra] = await db.insert(barbershop).values({ slug: 'outra', name: 'Outra' }).returning();
      await expect(cancelAppointment(db, outra.id, criado.appointmentId)).rejects.toThrow();
      const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
      expect(linha.status).toBe('BOOKED');
    });
  });
});
