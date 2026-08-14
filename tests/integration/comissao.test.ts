import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

/**
 * O percentual de comissão é a única configuração da tela de indicadores, e é
 * dinheiro: quem pode gravar, o que é recusado e até onde o escopo alcança
 * precisam de teste contra o banco de verdade.
 *
 * A sessão do Better-Auth é o único ponto substituído — `requireOwner` continua
 * resolvendo o vínculo (barbearia + papel) contra o Postgres de teste, que é
 * justamente a parte que não pode ser confiada a um mock.
 */
const sessaoFalsa = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () => (sessaoFalsa.userId ? { user: { id: sessaoFalsa.userId } } : null),
    },
  },
}));

import { eq } from 'drizzle-orm';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff } from '@/db/schema';
import { closeDb } from '@/db/client';
import { saveCommissionAction } from '@/app/app/equipe/[staffId]/actions';

const ESTADO_INICIAL = {};

beforeEach(() => {
  sessaoFalsa.userId = null;
});

afterAll(async () => {
  await closeDb();
});

async function semear(db: TestDb) {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'comissao-a', name: 'Comissão' })
    .returning();
  const [dono] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'Dono', role: 'OWNER', userId: 'u-dono' })
    .returning();
  const [barbeiro] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'Barbeiro', role: 'BARBER', userId: 'u-barbeiro' })
    .returning();
  return { loja, dono, barbeiro };
}

async function percentualDe(db: TestDb, staffId: string): Promise<number | null> {
  const [linha] = await db.select().from(staff).where(eq(staff.id, staffId));
  return linha.commissionPercent;
}

function formulario(valor: string): FormData {
  const form = new FormData();
  form.set('commissionPercent', valor);
  return form;
}

describe('saveCommissionAction', () => {
  it('grava o percentual do barbeiro', async () => {
    await withTestDb(async (db) => {
      const { barbeiro } = await semear(db);
      sessaoFalsa.userId = 'u-dono';

      const estado = await saveCommissionAction(barbeiro.id, ESTADO_INICIAL, formulario('40'));

      expect(estado.ok).toBe(true);
      expect(await percentualDe(db, barbeiro.id)).toBe(40);
    });
  });

  it('campo vazio grava nulo — nulo não é zero, e some do relatório', async () => {
    await withTestDb(async (db) => {
      const { barbeiro } = await semear(db);
      sessaoFalsa.userId = 'u-dono';

      await saveCommissionAction(barbeiro.id, ESTADO_INICIAL, formulario('40'));
      const estado = await saveCommissionAction(barbeiro.id, ESTADO_INICIAL, formulario(''));

      expect(estado.ok).toBe(true);
      expect(await percentualDe(db, barbeiro.id)).toBeNull();
    });
  });

  it('zero é configuração de verdade e fica gravado como zero', async () => {
    await withTestDb(async (db) => {
      const { barbeiro } = await semear(db);
      sessaoFalsa.userId = 'u-dono';

      await saveCommissionAction(barbeiro.id, ESTADO_INICIAL, formulario('0'));

      expect(await percentualDe(db, barbeiro.id)).toBe(0);
    });
  });

  it('recusa percentual acima de 100 — comissão maior que o faturamento', async () => {
    await withTestDb(async (db) => {
      const { barbeiro } = await semear(db);
      sessaoFalsa.userId = 'u-dono';

      const estado = await saveCommissionAction(barbeiro.id, ESTADO_INICIAL, formulario('120'));

      expect(estado.erro).toMatch(/0 e 100/);
      expect(await percentualDe(db, barbeiro.id)).toBeNull();
    });
  });

  it('recusa o que não é número inteiro em vez de gravar NaN', async () => {
    await withTestDb(async (db) => {
      const { barbeiro } = await semear(db);
      sessaoFalsa.userId = 'u-dono';

      for (const entrada of ['40%', '0,4', 'quarenta', '-10', '12.5']) {
        const estado = await saveCommissionAction(barbeiro.id, ESTADO_INICIAL, formulario(entrada));
        expect(estado.erro, `aceitou "${entrada}"`).toBeTruthy();
      }

      expect(await percentualDe(db, barbeiro.id)).toBeNull();
    });
  });

  it('recusa o barbeiro mexer na própria comissão', async () => {
    await withTestDb(async (db) => {
      const { barbeiro } = await semear(db);
      sessaoFalsa.userId = 'u-barbeiro';

      const estado = await saveCommissionAction(barbeiro.id, ESTADO_INICIAL, formulario('90'));

      expect(estado.erro).toMatch(/dono/i);
      expect(await percentualDe(db, barbeiro.id)).toBeNull();
    });
  });

  it('não alcança barbeiro de outra barbearia', async () => {
    await withTestDb(async (db) => {
      await semear(db);
      const [outra] = await db
        .insert(barbershop)
        .values({ slug: 'comissao-b', name: 'Outra' })
        .returning();
      const [alheio] = await db
        .insert(staff)
        .values({ barbershopId: outra.id, name: 'Alheio', role: 'BARBER' })
        .returning();
      sessaoFalsa.userId = 'u-dono';

      const estado = await saveCommissionAction(alheio.id, ESTADO_INICIAL, formulario('40'));

      expect(estado.erro).toBeTruthy();
      expect(await percentualDe(db, alheio.id)).toBeNull();
    });
  });
});
