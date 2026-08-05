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
