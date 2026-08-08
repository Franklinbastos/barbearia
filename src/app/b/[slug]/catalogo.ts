import { eq, and } from 'drizzle-orm';
import { staffService, staff } from '@/db/schema';
import { listActiveServices, listActiveStaff, type Db } from '@/db/repositories';
import type { Catalog } from './types';

/**
 * Loja como o catálogo precisa dela. Recebe a linha inteira de `barbershop`,
 * mas só lê estes campos — nem `phone` nem `createdAt` entram no payload.
 */
export type LojaDoCatalogo = {
  id: string;
  name: string;
  timeZone: string;
  maxAdvanceDays: number;
};

/**
 * Monta o catálogo público de uma barbearia: serviços ativos, equipe ativa e o
 * vínculo entre os dois. Única fonte para a rota `/api/public/[slug]/catalog` e
 * para a página `/b/[slug]`, para que rota e página não possam divergir.
 */
export async function carregarCatalogo(db: Db, loja: LojaDoCatalogo): Promise<Catalog> {
  const [servicos, equipe, vinculos] = await Promise.all([
    listActiveServices(db, loja.id),
    listActiveStaff(db, loja.id),
    db
      .select({ staffId: staffService.staffId, serviceId: staffService.serviceId })
      .from(staffService)
      .innerJoin(staff, eq(staff.id, staffService.staffId))
      .where(and(eq(staffService.barbershopId, loja.id), eq(staff.active, true))),
  ]);

  return {
    shop: { name: loja.name, timeZone: loja.timeZone, maxAdvanceDays: loja.maxAdvanceDays },
    services: servicos.map((s) => ({
      id: s.id,
      name: s.name,
      durationMinutes: s.durationMinutes,
      priceCents: s.priceCents,
    })),
    staff: equipe.map((b) => ({
      id: b.id,
      name: b.name,
      photoUrl: b.photoUrl,
      serviceIds: vinculos.filter((v) => v.staffId === b.id).map((v) => v.serviceId),
    })),
  };
}
