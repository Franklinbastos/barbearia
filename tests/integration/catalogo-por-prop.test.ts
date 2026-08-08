import { describe, it, expect } from 'vitest';
import { withTestDb } from '../helpers/db';
import { barbershop, staff, service, staffService } from '@/db/schema';
import { carregarCatalogo } from '@/app/b/[slug]/catalogo';

describe('carregarCatalogo', () => {
  it('devolve serviços, equipe e vínculos numa consulta do servidor', async () => {
    await withTestDb(async (db) => {
      const [loja] = await db.insert(barbershop).values({ slug: 'cat', name: 'Cat' }).returning();
      const [joao] = await db.insert(staff).values({ barbershopId: loja.id, name: 'João', role: 'OWNER' }).returning();
      const [corte] = await db.insert(service)
        .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: 30, priceCents: 4500 }).returning();
      await db.insert(staffService).values({ barbershopId: loja.id, staffId: joao.id, serviceId: corte.id });

      const cat = await carregarCatalogo(db, loja);

      expect(cat.shop.name).toBe('Cat');
      expect(cat.services.map((s) => s.name)).toEqual(['Corte']);
      expect(cat.staff[0].serviceIds).toEqual([corte.id]);
    });
  });

  it('não vaza telefone de cliente nem coluna interna', async () => {
    await withTestDb(async (db) => {
      const [loja] = await db.insert(barbershop).values({ slug: 'cat', name: 'Cat' }).returning();
      const cat = await carregarCatalogo(db, loja);
      expect(JSON.stringify(cat)).not.toMatch(/phone|createdAt/i);
    });
  });

  it('barbeiro inativo não entra no catálogo', async () => {
    await withTestDb(async (db) => {
      const [loja] = await db.insert(barbershop).values({ slug: 'cat', name: 'Cat' }).returning();
      await db.insert(staff).values({ barbershopId: loja.id, name: 'Fora', active: false });
      const cat = await carregarCatalogo(db, loja);
      expect(cat.staff).toHaveLength(0);
    });
  });
});
