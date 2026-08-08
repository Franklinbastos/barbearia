import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

/**
 * Sessão falsa do painel: o `requireSession` de verdade roda contra o banco de
 * teste, só o Better-Auth é substituído. O tenant desta rota **tem** de sair
 * daí — é o ponto que o teste de isolamento cobra.
 */
const sessaoFalsa = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: async () => (sessaoFalsa.userId ? { user: { id: sessaoFalsa.userId } } : null),
    },
  },
}));

import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff, service, customer, appointment } from '@/db/schema';
import { closeDb } from '@/db/client';
import { GET as getClientesRoute } from '@/app/api/panel/clientes/route';

type ClienteAchado = { id: string; name: string; phone: string; proximo: string | null };

async function buscar(q: string): Promise<ClienteAchado[]> {
  const res = await getClientesRoute(
    new Request(`http://x/api/panel/clientes?q=${encodeURIComponent(q)}`),
  );
  expect(res.status).toBe(200);
  const corpo = (await res.json()) as { clientes: ClienteAchado[] };
  return corpo.clientes;
}

async function semear(db: TestDb) {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'busca', name: 'Busca', timeZone: 'America/Sao_Paulo' })
    .returning();
  const [dono] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'Dono', role: 'OWNER', userId: 'u-dono' })
    .returning();
  const [corte] = await db
    .insert(service)
    .values({ barbershopId: loja.id, name: 'Corte', durationMinutes: 30, priceCents: 4000 })
    .returning();

  const [marcos] = await db
    .insert(customer)
    // Nome com acento e telefone com máscara: as duas coisas que o balcão
    // digita e que a busca ingênua não acha.
    .values({ barbershopId: loja.id, name: 'Marcos Antônio', phone: '(11) 99999-8888' })
    .returning();
  const [joana] = await db
    .insert(customer)
    .values({ barbershopId: loja.id, name: 'Joana Silva', phone: '11977776666' })
    .returning();

  sessaoFalsa.userId = 'u-dono';
  return { loja, dono, corte, marcos, joana };
}

/** Agendamento cru: o que se testa aqui é a consulta, não a regra de encaixe. */
async function agendar(
  db: TestDb,
  dados: { lojaId: string; staffId: string; customerId: string; startAt: Date; status?: 'BOOKED' | 'CANCELED' },
) {
  await db.insert(appointment).values({
    barbershopId: dados.lojaId,
    staffId: dados.staffId,
    customerId: dados.customerId,
    serviceNameSnapshot: 'Corte',
    servicePriceCentsSnapshot: 4000,
    serviceDurationMinutesSnapshot: 30,
    startAt: dados.startAt,
    endAt: new Date(dados.startAt.getTime() + 30 * 60_000),
    status: dados.status ?? 'BOOKED',
  });
}

const emDias = (dias: number) => new Date(Date.now() + dias * 86_400_000);

beforeEach(() => {
  sessaoFalsa.userId = null;
});

afterAll(async () => {
  await closeDb();
});

describe('busca de cliente no painel', () => {
  it('acha por parte do nome, sem acento e sem caixa', async () => {
    await withTestDb(async (db) => {
      await semear(db);

      expect((await buscar('marc')).map((c) => c.name)).toEqual(['Marcos Antônio']);
      // "ANTONIO" sem acento e em caixa-alta tem de achar "Antônio".
      expect((await buscar('ANTONIO')).map((c) => c.name)).toEqual(['Marcos Antônio']);
    });
  });

  it('acha por dígitos do telefone, ignorando máscara', async () => {
    await withTestDb(async (db) => {
      await semear(db);

      const achados = await buscar('99998');

      expect(achados.map((c) => c.phone)).toEqual(['(11) 99999-8888']);
    });
  });

  it('traz o próximo agendamento de cada cliente', async () => {
    await withTestDb(async (db) => {
      const { loja, dono, marcos, joana } = await semear(db);

      const proximo = emDias(2);
      await agendar(db, { lojaId: loja.id, staffId: dono.id, customerId: marcos.id, startAt: emDias(9) });
      await agendar(db, { lojaId: loja.id, staffId: dono.id, customerId: marcos.id, startAt: proximo });
      // Passado não conta, e cancelado também não.
      await agendar(db, { lojaId: loja.id, staffId: dono.id, customerId: marcos.id, startAt: emDias(-3) });
      await agendar(db, {
        lojaId: loja.id, staffId: dono.id, customerId: joana.id, startAt: emDias(1), status: 'CANCELED',
      });

      const achados = await buscar('a');
      expect(achados).toHaveLength(0); // um caractere não busca

      const [joanaAchada, marcosAchado] = await buscar('an');
      expect([joanaAchada, marcosAchado].map((c) => c.name)).toEqual(['Joana Silva', 'Marcos Antônio']);
      expect(marcosAchado.proximo).toBe(proximo.toISOString());
      expect(joanaAchada.proximo).toBeNull();
    });
  });

  it('nunca devolve cliente de outra barbearia', async () => {
    await withTestDb(async (db) => {
      await semear(db);
      const [outra] = await db
        .insert(barbershop)
        .values({ slug: 'outra-busca', name: 'Outra' })
        .returning();
      await db
        .insert(customer)
        .values({ barbershopId: outra.id, name: 'Marcelo Alheio', phone: '(11) 99999-0000' })
        .returning();

      expect((await buscar('marc')).map((c) => c.name)).toEqual(['Marcos Antônio']);
      expect((await buscar('99999')).map((c) => c.phone)).toEqual(['(11) 99999-8888']);
    });
  });

  it('busca vazia devolve lista vazia, não a base inteira', async () => {
    await withTestDb(async (db) => {
      await semear(db);

      expect(await buscar('')).toEqual([]);
      expect(await buscar('   ')).toEqual([]);
      // Curinga de LIKE não pode virar "tudo": tem de ser escapado e não achar
      // ninguém, porque nenhum nome tem "%".
      expect(await buscar('%%')).toEqual([]);
    });
  });
});
