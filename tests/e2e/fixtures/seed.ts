import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { barbershop, service, staff, staffService, workingHours, rateLimitBucket } from '@/db/schema';
import { createBarbershopForUser, EXPEDIENTE_PADRAO } from '@/domain/onboarding/create-barbershop';

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

/**
 * A mesma loja, com um segundo barbeiro no mesmo expediente e no mesmo serviço.
 *
 * É a única forma de provar a deduplicação da grade: `getAvailability` devolve
 * um slot **por barbeiro por horário**, então com dois barbeiros livres às 09:00
 * chegam dois slots e a tela tem de desenhar uma ficha só.
 */
export async function seedComDoisBarbeiros() {
  const base = await seed();

  const [segundo] = await db
    .insert(staff)
    .values({ barbershopId: base.barbershopId, userId: 'e2e-segundo', name: 'Pedro E2E', role: 'BARBER' })
    .returning();

  await db.insert(workingHours).values(
    EXPEDIENTE_PADRAO.map((bloco) => ({
      ...bloco,
      barbershopId: base.barbershopId,
      staffId: segundo.id,
    })),
  );

  await db
    .insert(staffService)
    .values({ barbershopId: base.barbershopId, staffId: segundo.id, serviceId: base.serviceId });

  return { ...base, segundoStaffId: segundo.id };
}
