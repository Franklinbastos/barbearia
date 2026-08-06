import { and, eq, gt, lte, sql } from 'drizzle-orm';
import { appointment, notificationLog } from '@/db/schema';
import type { Db } from '@/db/repositories';

export async function selectDueReminders(
  db: Db,
  args: { now: Date; windowMinutes: number },
): Promise<Array<{ barbershopId: string; appointmentId: string }>> {
  const limite = new Date(args.now.getTime() + args.windowMinutes * 60_000);

  const linhas = await db
    .select({ barbershopId: appointment.barbershopId, appointmentId: appointment.id })
    .from(appointment)
    .where(
      and(
        eq(appointment.status, 'BOOKED'),
        gt(appointment.startAt, args.now),
        lte(appointment.startAt, limite),
        sql`not exists (
          select 1 from ${notificationLog}
          where ${notificationLog.appointmentId} = ${appointment.id}
            and ${notificationLog.type} = 'REMINDER'
            and ${notificationLog.status} = 'SENT'
        )`,
      ),
    )
    .limit(500);

  return linhas;
}
