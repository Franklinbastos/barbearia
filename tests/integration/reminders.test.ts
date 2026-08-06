import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff, service, staffService, workingHours, notificationLog, appointment } from '@/db/schema';
import { createAppointment, cancelAppointment } from '@/domain/booking';
import { selectDueReminders } from '@/domain/reminders/select-due';

async function semear(db: TestDb) {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'teste', name: 'Teste', minLeadMinutes: 0 })
    .returning();
  const [joao] = await db.insert(staff).values({ barbershopId: loja.id, name: 'João', role: 'OWNER' }).returning();
  const [corte] = await db
    .insert(service)
    .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
    .returning();
  await db.insert(staffService).values({ barbershopId: loja.id, staffId: joao.id, serviceId: corte.id });
  await db.insert(workingHours).values([
    { barbershopId: loja.id, staffId: joao.id, weekday: 1, startTime: '09:00:00', endTime: '18:00:00' },
  ]);
  return { loja, joao, corte };
}

async function agendar(db: TestDb, ctx: Awaited<ReturnType<typeof semear>>, startAt: string, phone = '11999998888') {
  return createAppointment(db, {
    barbershopId: ctx.loja.id, serviceId: ctx.corte.id, staffId: ctx.joao.id,
    startAt: new Date(startAt), customer: { name: 'Cliente', phone }, origin: 'PUBLIC',
  });
}

const AGORA = new Date('2026-09-07T12:00:00Z'); // 09:00 em São Paulo

describe('selectDueReminders', () => {
  it('pega agendamento dentro da janela', async () => {
    await withTestDb(async (db) => {
      const ctx = await semear(db);
      const criado = await agendar(db, ctx, '2026-09-07T15:00:00Z');
      const devidos = await selectDueReminders(db, { now: AGORA, windowMinutes: 240 });
      expect(devidos.map((d) => d.appointmentId)).toEqual([criado.appointmentId]);
    });
  });

  it('ignora agendamento fora da janela', async () => {
    await withTestDb(async (db) => {
      const ctx = await semear(db);
      await agendar(db, ctx, '2026-09-07T20:00:00Z');
      expect(await selectDueReminders(db, { now: AGORA, windowMinutes: 240 })).toHaveLength(0);
    });
  });

  it('ignora agendamento que já passou', async () => {
    await withTestDb(async (db) => {
      const ctx = await semear(db);
      const criado = await agendar(db, ctx, '2026-09-07T13:00:00Z');
      await db.update(appointment).set({ startAt: new Date('2026-09-07T11:00:00Z'), endAt: new Date('2026-09-07T11:30:00Z') }).where(eq(appointment.id, criado.appointmentId));
      expect(await selectDueReminders(db, { now: AGORA, windowMinutes: 240 })).toHaveLength(0);
    });
  });

  it('ignora agendamento cancelado', async () => {
    await withTestDb(async (db) => {
      const ctx = await semear(db);
      const criado = await agendar(db, ctx, '2026-09-07T15:00:00Z');
      await cancelAppointment(db, ctx.loja.id, criado.appointmentId);
      expect(await selectDueReminders(db, { now: AGORA, windowMinutes: 240 })).toHaveLength(0);
    });
  });

  it('ignora agendamento que já recebeu lembrete', async () => {
    await withTestDb(async (db) => {
      const ctx = await semear(db);
      const criado = await agendar(db, ctx, '2026-09-07T15:00:00Z');
      await db.insert(notificationLog).values({
        barbershopId: ctx.loja.id, appointmentId: criado.appointmentId,
        type: 'REMINDER', status: 'SENT', providerMessageId: 'x',
      });
      expect(await selectDueReminders(db, { now: AGORA, windowMinutes: 240 })).toHaveLength(0);
    });
  });

  it('reinclui agendamento cujo lembrete falhou', async () => {
    await withTestDb(async (db) => {
      const ctx = await semear(db);
      const criado = await agendar(db, ctx, '2026-09-07T15:00:00Z');
      await db.insert(notificationLog).values({
        barbershopId: ctx.loja.id, appointmentId: criado.appointmentId,
        type: 'REMINDER', status: 'FAILED', error: 'timeout',
      });
      expect(await selectDueReminders(db, { now: AGORA, windowMinutes: 240 })).toHaveLength(1);
    });
  });
});
