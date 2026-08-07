import { and, eq, gt, inArray, lt, ne, sql } from 'drizzle-orm';
import { appointment } from '@/db/schema';
import type { Db } from '@/db/repositories';

/**
 * Quantos atendimentos ativos cada barbeiro tem naquele dia. É o desempate do
 * "qualquer barbeiro": sem ele, sai sempre o primeiro em ordem alfabética e um
 * barbeiro lota enquanto o outro fica parado.
 */
export async function countAppointmentsByStaff(
  db: Db,
  barbershopId: string,
  staffIds: string[],
  from: Date,
  to: Date,
): Promise<Map<string, number>> {
  if (staffIds.length === 0) return new Map();

  const linhas = await db
    .select({ staffId: appointment.staffId, total: sql<number>`count(*)::int` })
    .from(appointment)
    .where(
      and(
        eq(appointment.barbershopId, barbershopId),
        inArray(appointment.staffId, staffIds),
        ne(appointment.status, 'CANCELED'),
        lt(appointment.startAt, to),
        gt(appointment.endAt, from),
      ),
    )
    .groupBy(appointment.staffId);

  return new Map(linhas.map((l) => [l.staffId, Number(l.total)]));
}
