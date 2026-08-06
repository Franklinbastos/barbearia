import { and, eq } from 'drizzle-orm';
import { customer } from '@/db/schema';
import type { Db } from '@/db/repositories';
import { NotFoundError } from '@/domain/booking';

export async function anonymizeCustomer(db: Db, barbershopId: string, customerId: string) {
  const linhas = await db
    .update(customer)
    .set({
      name: 'Cliente removido',
      // O telefone vira um marcador único: o campo é UNIQUE por barbearia e
      // precisa liberar o número real para um cadastro novo.
      phone: `removido-${customerId}`,
      notes: null,
    })
    .where(and(eq(customer.barbershopId, barbershopId), eq(customer.id, customerId)))
    .returning({ id: customer.id });

  if (linhas.length === 0) throw new NotFoundError('Cliente não encontrado');
}
