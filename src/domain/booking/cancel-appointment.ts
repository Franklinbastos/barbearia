import { and, eq, ne } from 'drizzle-orm';
import { appointment } from '@/db/schema';
import type { Db } from '@/db/repositories';
import { NotFoundError } from './errors';

export async function cancelAppointment(db: Db, barbershopId: string, appointmentId: string) {
  const linhas = await db
    .update(appointment)
    .set({ status: 'CANCELED', canceledAt: new Date() })
    .where(
      and(
        eq(appointment.barbershopId, barbershopId),
        eq(appointment.id, appointmentId),
        ne(appointment.status, 'CANCELED'),
      ),
    )
    .returning({ id: appointment.id });

  if (linhas.length === 0) throw new NotFoundError('Agendamento não encontrado');
}
