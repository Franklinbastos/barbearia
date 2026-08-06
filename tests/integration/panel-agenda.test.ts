import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff, service, staffService, workingHours } from '@/db/schema';
import { createAppointment } from '@/domain/booking';
import { listAppointmentsBetween } from '@/db/repositories';

const SEGUNDA = '2026-09-07';

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
  await db.insert(workingHours).values({
    barbershopId: loja.id, staffId: joao.id, weekday: 1, startTime: '09:00:00', endTime: '11:00:00',
  });
  return { loja, joao, corte };
}

describe('agenda do painel', () => {
  it('lista os agendamentos do dia com o nome do cliente', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'),
        customer: { name: 'Cliente Um', phone: '11999998888' }, origin: 'PANEL',
      });

      const inicio = DateTime.fromISO(SEGUNDA, { zone: loja.timeZone }).startOf('day').toJSDate();
      const fim = DateTime.fromISO(SEGUNDA, { zone: loja.timeZone }).plus({ days: 1 }).startOf('day').toJSDate();
      const linhas = await listAppointmentsBetween(db, loja.id, inicio, fim);

      expect(linhas).toHaveLength(1);
      expect(linhas[0].customerName).toBe('Cliente Um');
      expect(linhas[0].serviceName).toBe('Corte');
      expect(linhas[0].origin).toBe('PANEL');
    });
  });

  it('não lista agendamentos de outro dia', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'),
        customer: { name: 'Cliente Um', phone: '11999998888' }, origin: 'PANEL',
      });

      const outroDia = DateTime.fromISO('2026-09-08', { zone: loja.timeZone });
      const linhas = await listAppointmentsBetween(
        db, loja.id, outroDia.startOf('day').toJSDate(), outroDia.plus({ days: 1 }).startOf('day').toJSDate(),
      );
      expect(linhas).toHaveLength(0);
    });
  });

  it('não lista agendamentos de outra barbearia', async () => {
    await withTestDb(async (db) => {
      const { loja, joao, corte } = await semear(db);
      await createAppointment(db, {
        barbershopId: loja.id, serviceId: corte.id, staffId: joao.id,
        startAt: new Date('2026-09-07T12:00:00Z'),
        customer: { name: 'Cliente Um', phone: '11999998888' }, origin: 'PANEL',
      });
      const [outra] = await db.insert(barbershop).values({ slug: 'outra', name: 'Outra' }).returning();

      const inicio = DateTime.fromISO(SEGUNDA, { zone: loja.timeZone }).startOf('day').toJSDate();
      const fim = DateTime.fromISO(SEGUNDA, { zone: loja.timeZone }).plus({ days: 1 }).startOf('day').toJSDate();
      expect(await listAppointmentsBetween(db, outra.id, inicio, fim)).toHaveLength(0);
    });
  });
});
