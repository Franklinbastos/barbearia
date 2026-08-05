import { and, eq, asc } from 'drizzle-orm';
import { service } from '@/db/schema';
import type { Db } from './types';

export async function listActiveServices(db: Db, barbershopId: string) {
  return db
    .select()
    .from(service)
    .where(and(eq(service.barbershopId, barbershopId), eq(service.active, true)))
    .orderBy(asc(service.sortOrder), asc(service.name));
}

export async function findServiceById(db: Db, barbershopId: string, serviceId: string) {
  const [linha] = await db
    .select()
    .from(service)
    .where(and(eq(service.barbershopId, barbershopId), eq(service.id, serviceId)))
    .limit(1);
  return linha ?? null;
}
