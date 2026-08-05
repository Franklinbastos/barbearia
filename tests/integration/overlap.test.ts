import { describe, it, expect } from 'vitest';
import { withTestDb } from '../helpers/db';
import { barbershop, staff, customer, appointment } from '@/db/schema';

async function semear(db: Awaited<ReturnType<typeof withTestDb>> extends never ? never : any) {
  const [loja] = await db.insert(barbershop).values({ slug: 'teste', name: 'Barbearia Teste' }).returning();
  const [barbeiro] = await db.insert(staff).values({ barbershopId: loja.id, name: 'João', role: 'OWNER' }).returning();
  const [cliente] = await db.insert(customer).values({ barbershopId: loja.id, name: 'Cliente', phone: '11999999999' }).returning();
  return { loja, barbeiro, cliente };
}

function agendamento(ids: { loja: any; barbeiro: any; cliente: any }, startISO: string, endISO: string) {
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
      await db.insert(appointment).values(agendamento(ids, '2026-09-01T12:00:00Z', '2026-09-01T12:30:00Z'));
      await db.insert(appointment).values(agendamento(ids, '2026-09-01T12:30:00Z', '2026-09-01T13:00:00Z'));
      const linhas = await db.select().from(appointment);
      expect(linhas).toHaveLength(2);
    });
  });

  it('libera o horário quando o agendamento é cancelado', async () => {
    await withTestDb(async (db, sql) => {
      const ids = await semear(db);
      const [primeiro] = await db
        .insert(appointment)
        .values(agendamento(ids, '2026-09-01T12:00:00Z', '2026-09-01T12:30:00Z'))
        .returning();
      await sql`UPDATE appointment SET status = 'CANCELED' WHERE id = ${primeiro.id}`;
      await db.insert(appointment).values(agendamento(ids, '2026-09-01T12:00:00Z', '2026-09-01T12:30:00Z'));
      const ativos = await sql`SELECT count(*) FROM appointment WHERE status = 'BOOKED'`;
      expect(Number(ativos[0].count)).toBe(1);
    });
  });
});
