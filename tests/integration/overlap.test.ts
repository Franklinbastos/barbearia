import { describe, it, expect } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { withTestDb, type TestDb } from '../helpers/db';
import { barbershop, staff, customer, appointment } from '@/db/schema';

async function semear(db: TestDb, slug = 'teste') {
  const [loja] = await db.insert(barbershop).values({ slug, name: `Barbearia ${slug}` }).returning();
  const [barbeiro] = await db.insert(staff).values({ barbershopId: loja.id, name: 'João', role: 'OWNER' }).returning();
  const [cliente] = await db.insert(customer).values({ barbershopId: loja.id, name: 'Cliente', phone: '11999999999' }).returning();
  return { loja, barbeiro, cliente };
}

type Sementes = Awaited<ReturnType<typeof semear>>;

/**
 * Agendamento de outra barbearia, no mesmo horário. Existe para provar que as
 * asserções deste arquivo contam só as linhas do tenant em teste — sem isso,
 * qualquer escrita vinda de fora (outra barbearia, um `next dev` aberto)
 * derrubaria o teste.
 */
async function semearRuidoDeOutraLoja(db: TestDb) {
  const outra = await semear(db, 'outra-loja');
  await db.insert(appointment).values(agendamento(outra, '2026-09-01T12:00:00Z', '2026-09-01T12:30:00Z'));
  return outra;
}

function agendamento(ids: Sementes, startISO: string, endISO: string) {
  return {
    barbershopId: ids.loja.id,
    staffId: ids.barbeiro.id,
    customerId: ids.cliente.id,
    serviceNameSnapshot: 'Corte',
    servicePriceCentsSnapshot: 4000,
    serviceDurationMinutesSnapshot: 30,
    startAt: new Date(startISO),
    endAt: new Date(endISO),
  };
}

describe('constraint de sobreposição de agendamentos', () => {
  it('recusa dois agendamentos sobrepostos no mesmo barbeiro', async () => {
    await withTestDb(async (db) => {
      const ids = await semear(db);
      await db.insert(appointment).values(agendamento(ids, '2026-09-01T12:00:00Z', '2026-09-01T12:30:00Z'));
      let erro: unknown;
      try {
        await db.insert(appointment).values(agendamento(ids, '2026-09-01T12:15:00Z', '2026-09-01T12:45:00Z'));
      } catch (e) {
        erro = e;
      }
      const mensagem = `${(erro as Error)?.message ?? ''} ${(erro as { cause?: Error })?.cause?.message ?? ''}`;
      expect(mensagem).toMatch(/exclus/i);
    });
  });

  it('aceita agendamentos encostados sem sobreposição', async () => {
    await withTestDb(async (db) => {
      const ids = await semear(db);
      await semearRuidoDeOutraLoja(db);
      await db.insert(appointment).values(agendamento(ids, '2026-09-01T12:00:00Z', '2026-09-01T12:30:00Z'));
      await db.insert(appointment).values(agendamento(ids, '2026-09-01T12:30:00Z', '2026-09-01T13:00:00Z'));
      const linhas = await db
        .select()
        .from(appointment)
        .where(eq(appointment.barbershopId, ids.loja.id));
      expect(linhas).toHaveLength(2);
    });
  });

  it('libera o horário quando o agendamento é cancelado', async () => {
    await withTestDb(async (db, sql) => {
      const ids = await semear(db);
      await semearRuidoDeOutraLoja(db);
      const [primeiro] = await db
        .insert(appointment)
        .values(agendamento(ids, '2026-09-01T12:00:00Z', '2026-09-01T12:30:00Z'))
        .returning();
      await sql`UPDATE appointment SET status = 'CANCELED' WHERE id = ${primeiro.id}`;
      await db.insert(appointment).values(agendamento(ids, '2026-09-01T12:00:00Z', '2026-09-01T12:30:00Z'));
      const ativos = await db
        .select()
        .from(appointment)
        .where(and(eq(appointment.barbershopId, ids.loja.id), eq(appointment.status, 'BOOKED')));
      expect(ativos).toHaveLength(1);
    });
  });
});
