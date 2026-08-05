import { and, eq, lt, gt, ne, asc } from 'drizzle-orm';
import { appointment, timeOff, customer } from '@/db/schema';
import type { Db } from './types';

/** Agendamentos ativos e bloqueios do barbeiro que tocam a janela [from, to). */
export async function listBusyRanges(
  db: Db,
  barbershopId: string,
  staffId: string,
  from: Date,
  to: Date,
) {
  const agendamentos = await db
    .select({ start: appointment.startAt, end: appointment.endAt })
    .from(appointment)
    .where(
      and(
        eq(appointment.barbershopId, barbershopId),
        eq(appointment.staffId, staffId),
        ne(appointment.status, 'CANCELED'),
        lt(appointment.startAt, to),
        gt(appointment.endAt, from),
      ),
    );

  const bloqueios = await db
    .select({ start: timeOff.startAt, end: timeOff.endAt })
    .from(timeOff)
    .where(
      and(
        eq(timeOff.barbershopId, barbershopId),
        eq(timeOff.staffId, staffId),
        lt(timeOff.startAt, to),
        gt(timeOff.endAt, from),
      ),
    );

  return [...agendamentos, ...bloqueios];
}

export async function listAppointmentsBetween(db: Db, barbershopId: string, from: Date, to: Date) {
  return db
    .select({
      id: appointment.id,
      staffId: appointment.staffId,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      status: appointment.status,
      origin: appointment.origin,
      serviceName: appointment.serviceNameSnapshot,
      servicePriceCents: appointment.servicePriceCentsSnapshot,
      customerName: customer.name,
      customerPhone: customer.phone,
    })
    .from(appointment)
    .innerJoin(customer, eq(customer.id, appointment.customerId))
    .where(
      and(
        eq(appointment.barbershopId, barbershopId),
        lt(appointment.startAt, to),
        gt(appointment.endAt, from),
      ),
    )
    .orderBy(asc(appointment.startAt));
}

export async function findAppointmentById(db: Db, barbershopId: string, id: string) {
  const [linha] = await db
    .select()
    .from(appointment)
    .where(and(eq(appointment.barbershopId, barbershopId), eq(appointment.id, id)))
    .limit(1);
  return linha ?? null;
}
