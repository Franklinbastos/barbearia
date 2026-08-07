import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { withTestDb, type TestDb } from '../helpers/db';
import {
  barbershop,
  staff,
  service,
  staffService,
  workingHours,
  customer,
  appointment,
  notificationLog,
} from '@/db/schema';
import { createAppointment } from '@/domain/booking';
import { notifyOnce } from '@/notifications/notify';
import type { NotificationSender } from '@/notifications/sender';

async function semearComAgendamento(db: TestDb, slug = 'teste') {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug, name: `Teste ${slug}`, minLeadMinutes: 0, maxAdvanceDays: 3650 })
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

/**
 * Notificações de outra barbearia, gravadas direto no banco. Existem para
 * provar que as asserções deste arquivo contam só as linhas do tenant em teste
 * — contagem global de `notification_log` quebra com qualquer escrita externa.
 */
async function semearRuidoDeOutraLoja(db: TestDb) {
  const [outra] = await db
    .insert(barbershop)
    .values({ slug: 'outra-loja', name: 'Outra Loja' })
    .returning();
  const [barbeiro] = await db
    .insert(staff)
    .values({ barbershopId: outra.id, name: 'Outro', role: 'OWNER' })
    .returning();
  const [cliente] = await db
    .insert(customer)
    .values({ barbershopId: outra.id, name: 'Cliente Ruído', phone: '11900000000' })
    .returning();
  const [agendamento] = await db
    .insert(appointment)
    .values({
      barbershopId: outra.id,
      staffId: barbeiro.id,
      customerId: cliente.id,
      serviceNameSnapshot: 'Corte',
      servicePriceCentsSnapshot: 4000,
      serviceDurationMinutesSnapshot: 30,
      startAt: new Date('2026-09-07T12:00:00Z'),
      endAt: new Date('2026-09-07T12:30:00Z'),
    })
    .returning();
  await db.insert(notificationLog).values([
    {
      barbershopId: outra.id,
      appointmentId: agendamento.id,
      type: 'CONFIRMATION',
      status: 'SENT',
      providerMessageId: 'ruido_1',
    },
    {
      barbershopId: outra.id,
      appointmentId: agendamento.id,
      type: 'REMINDER',
      status: 'FAILED',
      error: 'ruído',
    },
  ]);
  return outra;
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
      await semearRuidoDeOutraLoja(db);
      const sender = senderFake();

      const r = await notifyOnce(db, { barbershopId: loja.id, appointmentId, type: 'CONFIRMATION', sender });

      expect(r).toBe('SENT');
      expect(sender.chamadas).toBe(1);
      const linhas = await db
        .select()
        .from(notificationLog)
        .where(eq(notificationLog.barbershopId, loja.id));
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

  it('manda um lembrete só quando duas execuções do cron se sobrepõem', async () => {
    await withTestDb(async (db) => {
      const { loja, appointmentId } = await semearComAgendamento(db);
      await semearRuidoDeOutraLoja(db);
      const sender = senderFake();
      const args = { barbershopId: loja.id, appointmentId, type: 'REMINDER' as const, sender };

      // Simultâneas: as duas passariam por um SELECT-e-depois-envia sem se ver.
      const resultados = await Promise.all([notifyOnce(db, args), notifyOnce(db, args)]);

      expect(sender.chamadas).toBe(1);
      expect([...resultados].sort()).toEqual(['SENT', 'SKIPPED']);
      const linhas = await db
        .select()
        .from(notificationLog)
        .where(eq(notificationLog.barbershopId, loja.id));
      expect(linhas).toHaveLength(1);
      expect(linhas[0].status).toBe('SENT');
      expect(linhas[0].providerMessageId).toBe('msg_1');
    });
  });

  it('não reenvia em dobro quando dois cron retomam a mesma falha', async () => {
    await withTestDb(async (db) => {
      const { loja, appointmentId } = await semearComAgendamento(db);
      await db.insert(notificationLog).values({
        barbershopId: loja.id, appointmentId, type: 'REMINDER', status: 'FAILED', error: 'timeout',
      });
      const sender = senderFake();
      const args = { barbershopId: loja.id, appointmentId, type: 'REMINDER' as const, sender };

      const resultados = await Promise.all([notifyOnce(db, args), notifyOnce(db, args)]);

      expect(sender.chamadas).toBe(1);
      expect([...resultados].sort()).toEqual(['SENT', 'SKIPPED']);
    });
  });

  it('permite tipos diferentes para o mesmo agendamento', async () => {
    await withTestDb(async (db) => {
      const { loja, appointmentId } = await semearComAgendamento(db);
      await semearRuidoDeOutraLoja(db);
      const sender = senderFake();

      await notifyOnce(db, { barbershopId: loja.id, appointmentId, type: 'CONFIRMATION', sender });
      await notifyOnce(db, { barbershopId: loja.id, appointmentId, type: 'REMINDER', sender });

      expect(sender.chamadas).toBe(2);
      const linhas = await db
        .select()
        .from(notificationLog)
        .where(eq(notificationLog.barbershopId, loja.id));
      expect(linhas).toHaveLength(2);
    });
  });

  it('registra a falha sem derrubar o chamador', async () => {
    await withTestDb(async (db) => {
      const { loja, appointmentId } = await semearComAgendamento(db);
      await semearRuidoDeOutraLoja(db);
      const senderQuebrado: NotificationSender = {
        async send() { throw new Error('provider fora do ar'); },
      };

      const r = await notifyOnce(db, {
        barbershopId: loja.id, appointmentId, type: 'CONFIRMATION', sender: senderQuebrado,
      });

      expect(r).toBe('FAILED');
      const [linha, ...resto] = await db
        .select()
        .from(notificationLog)
        .where(eq(notificationLog.barbershopId, loja.id));
      expect(resto).toHaveLength(0);
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
