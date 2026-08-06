import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { barbershop, service, staffService, rateLimitBucket } from '@/db/schema';
import { createBarbershopForUser } from '@/domain/onboarding/create-barbershop';

const SLUG = 'e2e-barbearia';

export async function seed() {
  await db.delete(barbershop).where(eq(barbershop.slug, SLUG));
  // Limpa o rate limit entre execuções: mesmo telefone/IP de teste não pode
  // acumular contagem de execuções anteriores.
  await db.delete(rateLimitBucket);

  const { barbershopId, staffId } = await createBarbershopForUser(db, {
    userId: 'e2e-owner',
    name: 'E2E Barbearia',
    slug: SLUG,
    timeZone: 'America/Sao_Paulo',
    ownerName: 'Dono E2E',
  });

  await db.update(barbershop).set({ minLeadMinutes: 0 }).where(eq(barbershop.id, barbershopId));

  const [corte] = await db
    .insert(service)
    .values({ barbershopId, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
    .returning();

  await db.insert(staffService).values({ barbershopId, staffId, serviceId: corte.id });

  return { barbershopId, staffId, serviceId: corte.id };
}
