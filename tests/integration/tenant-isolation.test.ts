import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff, service, customer } from '@/db/schema';
import {
  findBarbershopBySlug,
  listActiveStaff,
  listActiveServices,
  findServiceById,
  upsertCustomer,
} from '@/db/repositories';

async function semearDuasLojas(db: TestDb) {
  const [a] = await db.insert(barbershop).values({ slug: 'loja-a', name: 'Loja A' }).returning();
  const [b] = await db.insert(barbershop).values({ slug: 'loja-b', name: 'Loja B' }).returning();
  await db.insert(staff).values([
    { barbershopId: a.id, name: 'Barbeiro A', role: 'OWNER' },
    { barbershopId: b.id, name: 'Barbeiro B', role: 'OWNER' },
  ]);
  const [servicoB] = await db
    .insert(service)
    .values({ barbershopId: b.id, name: 'Corte B', durationMinutes: 30, priceCents: 5000 })
    .returning();
  return { a, b, servicoB };
}

describe('isolamento entre barbearias', () => {
  it('lista só a equipe da própria barbearia', async () => {
    await withTestDb(async (db) => {
      const { a } = await semearDuasLojas(db);
      const equipe = await listActiveStaff(db, a.id);
      expect(equipe.map((s) => s.name)).toEqual(['Barbeiro A']);
    });
  });

  it('lista só os serviços da própria barbearia', async () => {
    await withTestDb(async (db) => {
      const { a } = await semearDuasLojas(db);
      expect(await listActiveServices(db, a.id)).toEqual([]);
    });
  });

  it('não devolve serviço de outra barbearia mesmo com o id correto', async () => {
    await withTestDb(async (db) => {
      const { a, servicoB } = await semearDuasLojas(db);
      expect(await findServiceById(db, a.id, servicoB.id)).toBeNull();
    });
  });

  it('trata o mesmo telefone em barbearias diferentes como clientes distintos', async () => {
    await withTestDb(async (db) => {
      const { a, b } = await semearDuasLojas(db);
      const clienteA = await upsertCustomer(db, a.id, { name: 'Zé', phone: '11988887777' });
      const clienteB = await upsertCustomer(db, b.id, { name: 'Zé', phone: '11988887777' });
      expect(clienteA.id).not.toBe(clienteB.id);
    });
  });

  it('atualiza o nome do cliente existente sem criar duplicata', async () => {
    await withTestDb(async (db) => {
      const { a, b } = await semearDuasLojas(db);
      // Cliente de outra barbearia, mesmo telefone: a contagem abaixo tem que
      // enxergar só a loja A, senão qualquer escrita externa derruba o teste.
      await upsertCustomer(db, b.id, { name: 'Zé da Loja B', phone: '11988887777' });
      const primeiro = await upsertCustomer(db, a.id, { name: 'Zé', phone: '11988887777' });
      const segundo = await upsertCustomer(db, a.id, { name: 'José', phone: '11988887777' });
      expect(segundo.id).toBe(primeiro.id);
      expect(segundo.name).toBe('José');
      const todos = await db.select().from(customer).where(eq(customer.barbershopId, a.id));
      expect(todos).toHaveLength(1);
    });
  });

  it('resolve barbearia por slug', async () => {
    await withTestDb(async (db) => {
      await semearDuasLojas(db);
      const encontrada = await findBarbershopBySlug(db, 'loja-b');
      expect(encontrada?.name).toBe('Loja B');
      expect(await findBarbershopBySlug(db, 'nao-existe')).toBeNull();
    });
  });
});
