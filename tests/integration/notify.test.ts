import { describe, it, expect } from 'vitest';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff, service, staffService, workingHours, notificationLog } from '@/db/schema';
import { createAppointment } from '@/domain/booking';
import { notifyOnce } from '@/notifications/notify';
import type { NotificationSender } from '@/notifications/sender';

async function semearComAgendamento(db: TestDb) {
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
  await db.insert(workingHours).values({
    barbershopId: loja.id, staffId: joao.id, weekday: 1, startTime: '09:00:00', endTime: '11:00:00',
  });
  const criado = await createAppointment(db, {
    barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
    startAt: new Date('2026-09-07T12:00:00Z'),
    customer: { name: 'Cliente', phone: '11999998888' }, origin: 'PUBLIC',
  });
  return { loja, appointmentId: criado.appointmentId };
}

function senderFake(): NotificationSender & { chamadas: number } {
  const fake = {
    chamadas: 0,
    async send() {
      fake.chamadas += 1;
      return { providerMessageId: `msg_${fake.chamadas}` };
    },
  };
  return fake;
}

describe('notifyOnce', () => {
  it('envia e registra no log', async () => {
    await withTestDb(async (db) => {
      const { loja, appointmentId } = await semearComAgendamento(db);
      const sender = senderFake();

      const r = await notifyOnce(db, { barbershopId: loja.id, appointmentId, type: 'CONFIRMATION', sender });

      expect(r).toBe('SENT');
      expect(sender.chamadas).toBe(1);
      const linhas = await db.select().from(notificationLog);
      expect(linhas).toHaveLength(1);
      expect(linhas[0].status).toBe('SENT');
      expect(linhas[0].providerMessageId).toBe('msg_1');
    });
  });

  it('não envia duas vezes o mesmo tipo para o mesmo agendamento', async () => {
    await withTestDb(async (db) => {
      const { loja, appointmentId } = await semearComAgendamento(db);
      const sender = senderFake();
      const args = { barbershopId: loja.id, appointmentId, type: 'REMINDER' as const, sender };

      expect(await notifyOnce(db, args)).toBe('SENT');
      expect(await notifyOnce(db, args)).toBe('SKIPPED');
      expect(sender.chamadas).toBe(1);
    });
  });

  it('permite tipos diferentes para o mesmo agendamento', async () => {
    await withTestDb(async (db) => {
      const { loja, appointmentId } = await semearComAgendamento(db);
      const sender = senderFake();

      await notifyOnce(db, { barbershopId: loja.id, appointmentId, type: 'CONFIRMATION', sender });
      await notifyOnce(db, { barbershopId: loja.id, appointmentId, type: 'REMINDER', sender });

      expect(sender.chamadas).toBe(2);
      expect(await db.select().from(notificationLog)).toHaveLength(2);
    });
  });

  it('registra a falha sem derrubar o chamador', async () => {
    await withTestDb(async (db) => {
      const { loja, appointmentId } = await semearComAgendamento(db);
      const senderQuebrado: NotificationSender = {
        async send() { throw new Error('provider fora do ar'); },
      };

      const r = await notifyOnce(db, {
        barbershopId: loja.id, appointmentId, type: 'CONFIRMATION', sender: senderQuebrado,
      });

      expect(r).toBe('FAILED');
      const [linha] = await db.select().from(notificationLog);
      expect(linha.status).toBe('FAILED');
      expect(linha.error).toContain('provider fora do ar');
    });
  });

  it('deixa reenviar depois de uma falha', async () => {
    await withTestDb(async (db) => {
      const { loja, appointmentId } = await semearComAgendamento(db);
      const senderQuebrado: NotificationSender = {
        async send() { throw new Error('falhou'); },
      };
      await notifyOnce(db, { barbershopId: loja.id, appointmentId, type: 'REMINDER', sender: senderQuebrado });

      const sender = senderFake();
      expect(await notifyOnce(db, { barbershopId: loja.id, appointmentId, type: 'REMINDER', sender })).toBe('SENT');
      expect(sender.chamadas).toBe(1);
    });
  });
});
