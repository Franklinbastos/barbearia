import { and, eq, ilike, or, desc, asc } from 'drizzle-orm';
import { customer, appointment } from '@/db/schema';
import type { Db } from './types';

export async function upsertCustomer(
  db: Db,
  barbershopId: string,
  dados: { name: string; phone: string },
) {
  const [linha] = await db
    .insert(customer)
    .values({ barbershopId, name: dados.name, phone: dados.phone })
    .onConflictDoUpdate({
      target: [customer.barbershopId, customer.phone],
      set: { name: dados.name },
    })
    .returning();
  return linha;
}

export async function listCustomers(db: Db, barbershopId: string, busca?: string) {
  const filtroBusca = busca
    ? or(ilike(customer.name, `%${busca}%`), ilike(customer.phone, `%${busca}%`))
    : undefined;

  return db
    .select()
    .from(customer)
    .where(and(eq(customer.barbershopId, barbershopId), filtroBusca))
    .orderBy(asc(customer.name))
    .limit(200);
}

export async function findCustomerById(db: Db, barbershopId: string, customerId: string) {
  const [linha] = await db
    .select()
    .from(customer)
    .where(and(eq(customer.barbershopId, barbershopId), eq(customer.id, customerId)))
    .limit(1);
  return linha ?? null;
}

export async function listCustomerHistory(db: Db, barbershopId: string, customerId: string) {
  return db
    .select({
      id: appointment.id,
      startAt: appointment.startAt,
      status: appointment.status,
      serviceName: appointment.serviceNameSnapshot,
      priceCents: appointment.servicePriceCentsSnapshot,
    })
    .from(appointment)
    .where(
      and(eq(appointment.barbershopId, barbershopId), eq(appointment.customerId, customerId)),
    )
    .orderBy(desc(appointment.startAt))
    .limit(100);
}
