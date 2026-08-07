import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff, service, staffService, workingHours, appointment, customer } from '@/db/schema';
import { createAppointment } from '@/domain/booking';
import { anonymizeCustomer } from '@/domain/privacy/anonymize-customer';

async function semearComCliente(db: TestDb) {
  const [loja] = await db
    .insert(barbershop)
    // maxAdvanceDays largo de propósito: este arquivo testa anonimização, não a
    // janela de agendamento, e a data fixa de 2026-09-07 passaria do padrão de 30 dias.
    .values({ slug: 'teste', name: 'Teste', minLeadMinutes: 0, maxAdvanceDays: 3650 })
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
    customer: { name: 'Cliente Real', phone: '11999998888' }, origin: 'PUBLIC',
  });
  const [linha] = await db.select().from(appointment).where(eq(appointment.id, criado.appointmentId));
  return { loja, customerId: linha.customerId, appointmentId: criado.appointmentId };
}

describe('anonymizeCustomer', () => {
  it('apaga os dados pessoais e mantém o agendamento', async () => {
    await withTestDb(async (db) => {
      const { loja, customerId, appointmentId } = await semearComCliente(db);

      await anonymizeCustomer(db, loja.id, customerId);

      const [c] = await db.select().from(customer).where(eq(customer.id, customerId));
      expect(c.name).toBe('Cliente removido');
      expect(c.phone).not.toContain('99999');
      expect(c.notes).toBeNull();

      const [a] = await db.select().from(appointment).where(eq(appointment.id, appointmentId));
      expect(a.serviceNameSnapshot).toBe('Corte');
      expect(a.startAt).toBeInstanceOf(Date);
    });
  });

  it('não anonimiza cliente de outra barbearia', async () => {
    await withTestDb(async (db) => {
      const { customerId } = await semearComCliente(db);
      const [outra] = await db.insert(barbershop).values({ slug: 'outra', name: 'Outra' }).returning();

      await expect(anonymizeCustomer(db, outra.id, customerId)).rejects.toThrow();

      const [c] = await db.select().from(customer).where(eq(customer.id, customerId));
      expect(c.name).toBe('Cliente Real');
    });
  });

  it('deixa o telefone livre para um novo cadastro', async () => {
    await withTestDb(async (db) => {
      const { loja, customerId } = await semearComCliente(db);
      await anonymizeCustomer(db, loja.id, customerId);

      const [novo] = await db
        .insert(customer)
        .values({ barbershopId: loja.id, name: 'Outro Cliente', phone: '11999998888' })
        .returning();
      expect(novo.id).not.toBe(customerId);
    });
  });
});
