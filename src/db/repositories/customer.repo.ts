import { customer } from '@/db/schema';
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
