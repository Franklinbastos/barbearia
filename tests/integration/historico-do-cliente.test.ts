import { describe, it, expect, afterAll } from 'vitest';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff, customer, appointment } from '@/db/schema';
import { closeDb } from '@/db/client';
import { listCustomerHistory } from '@/db/repositories';
import { calcularPerfilDoCliente } from '@/domain/indicadores/perfil-do-cliente';

/**
 * O histórico que alimenta a ficha do cliente.
 *
 * O que se cobre aqui é o `innerJoin` com `staff`: sem ele o barbeiro não chega
 * na ficha, e com ele malfeito o histórico perderia linhas caladamente — que é
 * o jeito de um join errar sem quebrar nada visível.
 */
const TZ = 'America/Sao_Paulo';

async function semear(db: TestDb) {
  const [loja] = await db
    .insert(barbershop)
    .values({ slug: 'historico', name: 'Histórico', timeZone: TZ })
    .returning();
  const [marcao] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'Marcão', role: 'OWNER' })
    .returning();
  const [tiago] = await db
    .insert(staff)
    .values({ barbershopId: loja.id, name: 'Tiago' })
    .returning();
  const [marcos] = await db
    .insert(customer)
    .values({ barbershopId: loja.id, name: 'Marcos', phone: '11999998888' })
    .returning();

  return { loja, marcao, tiago, marcos };
}

async function agendar(
  db: TestDb,
  dados: {
    lojaId: string;
    staffId: string;
    customerId: string;
    startAt: Date;
    status: 'BOOKED' | 'DONE' | 'CANCELED' | 'NO_SHOW';
    priceCents?: number;
  },
) {
  await db.insert(appointment).values({
    barbershopId: dados.lojaId,
    staffId: dados.staffId,
    customerId: dados.customerId,
    serviceNameSnapshot: 'Corte',
    servicePriceCentsSnapshot: dados.priceCents ?? 5000,
    serviceDurationMinutesSnapshot: 30,
    startAt: dados.startAt,
    endAt: new Date(dados.startAt.getTime() + 30 * 60_000),
    status: dados.status,
  });
}

const dias = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

afterAll(async () => {
  await closeDb();
});

describe('listCustomerHistory', () => {
  it('traz o barbeiro de cada atendimento, sem perder linha', async () => {
    await withTestDb(async (db) => {
      const { loja, marcao, tiago, marcos } = await semear(db);
      await agendar(db, {
        lojaId: loja.id,
        staffId: marcao.id,
        customerId: marcos.id,
        startAt: dias(30),
        status: 'DONE',
      });
      await agendar(db, {
        lojaId: loja.id,
        staffId: tiago.id,
        customerId: marcos.id,
        startAt: dias(15),
        status: 'NO_SHOW',
      });

      const historico = await listCustomerHistory(db, loja.id, marcos.id);

      // Do mais recente para o mais antigo, como a ficha lista.
      expect(historico.map((h) => h.staffName)).toEqual(['Tiago', 'Marcão']);
    });
  });

  it('devolve o histórico na forma que o perfil consome', async () => {
    await withTestDb(async (db) => {
      const { loja, marcao, marcos } = await semear(db);
      // Ritmo de 15 dias e trinta sem aparecer: passou de 1,5× o próprio ritmo.
      for (const atras of [60, 45, 30]) {
        await agendar(db, {
          lojaId: loja.id,
          staffId: marcao.id,
          customerId: marcos.id,
          startAt: dias(atras),
          status: 'DONE',
          priceCents: 5000,
        });
      }

      const historico = await listCustomerHistory(db, loja.id, marcos.id);
      // Sem adaptador no meio: o que sai da consulta entra na função pura como
      // está, e é isso que mantém a ficha sem consulta nova.
      const perfil = calcularPerfilDoCliente(historico, new Date());

      expect(perfil.totalGastoCents).toBe(15_000);
      expect(perfil.atendimentos).toBe(3);
      expect(perfil.intervaloTipico).toBe(15);
      expect(perfil.barbeiroPreferido).toBe('Marcão');
      expect(perfil.sumido).toBe(true);
    });
  });
});
