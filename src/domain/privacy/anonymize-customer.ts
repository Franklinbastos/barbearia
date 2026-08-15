import { and, eq } from 'drizzle-orm';
import { customer } from '@/db/schema';
import type { Db } from '@/db/repositories';
import { NotFoundError } from '@/domain/booking';

/**
 * O nome que substitui o do cliente removido. Fica exportado porque a ficha
 * precisa reconhecer quem já passou por aqui: sem isso ela continua oferecendo
 * "remover os dados" de quem não tem mais dado nenhum, e o botão sai dizendo
 * "Remover os dados de Cliente" — o primeiro nome de "Cliente removido".
 */
export const NOME_ANONIMIZADO = 'Cliente removido';

/** O telefone vira `removido-<id>`; é por ele que se reconhece com certeza. */
export function estaAnonimizado(cliente: { phone: string }): boolean {
  return cliente.phone.startsWith('removido-');
}

export async function anonymizeCustomer(db: Db, barbershopId: string, customerId: string) {
  const linhas = await db
    .update(customer)
    .set({
      name: NOME_ANONIMIZADO,
      // O telefone vira um marcador único: o campo é UNIQUE por barbearia e
      // precisa liberar o número real para um cadastro novo.
      phone: `removido-${customerId}`,
      notes: null,
    })
    .where(and(eq(customer.barbershopId, barbershopId), eq(customer.id, customerId)))
    .returning({ id: customer.id });

  if (linhas.length === 0) throw new NotFoundError('Cliente não encontrado');
}
