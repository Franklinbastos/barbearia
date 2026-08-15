import { eq } from 'drizzle-orm';
import { barbershop } from '@/db/schema';
import type { Db } from './types';

export async function findBarbershopBySlug(db: Db, slug: string) {
  const [linha] = await db.select().from(barbershop).where(eq(barbershop.slug, slug)).limit(1);
  return linha ?? null;
}

export async function findBarbershopById(db: Db, id: string) {
  const [linha] = await db.select().from(barbershop).where(eq(barbershop.id, id)).limit(1);
  return linha ?? null;
}

/**
 * Tenant por chave: o plug do brain não tem slug na URL, só o header
 * `X-Internal-Api-Key`. Chave vazia nunca bate — nenhuma barbearia tem
 * `internal_api_key` igual a `''`, só `NULL` (integração desligada), e `NULL`
 * não compara igual a nada em SQL.
 */
export async function findBarbershopByInternalApiKey(db: Db, chave: string) {
  const [linha] = await db
    .select()
    .from(barbershop)
    .where(eq(barbershop.internalApiKey, chave))
    .limit(1);
  return linha ?? null;
}
