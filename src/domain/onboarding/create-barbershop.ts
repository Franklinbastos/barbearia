import { barbershop, staff, workingHours } from '@/db/schema';
import type { Db } from '@/db/repositories';

const SLUGS_RESERVADOS = new Set(['app', 'api', 'login', 'signup', 'admin', 'b', '_next']);

export function normalizeSlug(input: string): string {
  const slug = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) throw new Error('Não foi possível gerar um slug a partir desse nome');
  if (SLUGS_RESERVADOS.has(slug)) throw new Error(`O endereço "${slug}" é reservado, escolha outro`);
  return slug;
}

/** Expediente padrão: segunda a sábado, 9h às 18h, com parada das 12h às 13h. */
export const EXPEDIENTE_PADRAO = [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
  { weekday, startTime: '09:00:00', endTime: '12:00:00' },
  { weekday, startTime: '13:00:00', endTime: '18:00:00' },
]);

export async function createBarbershopForUser(
  db: Db,
  dados: { userId: string; name: string; slug: string; timeZone: string; ownerName: string },
) {
  const slug = normalizeSlug(dados.slug);

  return db.transaction(async (tx) => {
    const [loja] = await tx
      .insert(barbershop)
      .values({ slug, name: dados.name, timeZone: dados.timeZone })
      .returning();

    const [dono] = await tx
      .insert(staff)
      .values({ barbershopId: loja.id, userId: dados.userId, name: dados.ownerName, role: 'OWNER' })
      .returning();

    await tx.insert(workingHours).values(
      EXPEDIENTE_PADRAO.map((bloco) => ({ ...bloco, barbershopId: loja.id, staffId: dono.id })),
    );

    return { barbershopId: loja.id, staffId: dono.id };
  });
}
