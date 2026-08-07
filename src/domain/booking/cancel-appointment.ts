import { and, eq, gt, ne } from 'drizzle-orm';
import { appointment } from '@/db/schema';
import type { Db } from '@/db/repositories';
import { CancelNotAllowedError, NotFoundError } from './errors';

/**
 * De onde veio o cancelamento.
 *
 * `CUSTOMER` é o link com `manageToken`, que vale 90 dias e sobrevive em
 * histórico de navegador e em pré-visualização de link: só pode desmarcar
 * agendamento `BOOKED` que ainda não começou. `PANEL` é a barbearia logada, que
 * pode fechar o que quiser — inclusive um atendimento de semana passada.
 *
 * O padrão é `CUSTOMER` de propósito: chamador que esquecer de dizer de onde
 * fala cai no caminho restrito, não no permissivo.
 */
export type CancelOrigin = 'CUSTOMER' | 'PANEL';

export async function cancelAppointment(
  db: Db,
  barbershopId: string,
  appointmentId: string,
  opts: { origin?: CancelOrigin; now?: Date } = {},
) {
  const origem = opts.origin ?? 'CUSTOMER';
  const agora = opts.now ?? new Date();

  const [atual] = await db
    .select({ status: appointment.status, startAt: appointment.startAt })
    .from(appointment)
    .where(and(eq(appointment.barbershopId, barbershopId), eq(appointment.id, appointmentId)))
    .limit(1);

  if (!atual || atual.status === 'CANCELED') {
    throw new NotFoundError('Agendamento não encontrado');
  }

  if (origem === 'CUSTOMER') {
    if (atual.status !== 'BOOKED') {
      throw new CancelNotAllowedError('Esse atendimento já foi fechado pela barbearia');
    }
    if (atual.startAt.getTime() <= agora.getTime()) {
      throw new CancelNotAllowedError(
        'Esse horário já começou. Para cancelar, fale com a barbearia.',
      );
    }
  }

  // As mesmas guardas no UPDATE: entre o SELECT e aqui, o painel pode ter
  // fechado o atendimento.
  const linhas = await db
    .update(appointment)
    .set({ status: 'CANCELED', canceledAt: agora })
    .where(
      and(
        eq(appointment.barbershopId, barbershopId),
        eq(appointment.id, appointmentId),
        origem === 'CUSTOMER' ? eq(appointment.status, 'BOOKED') : ne(appointment.status, 'CANCELED'),
        origem === 'CUSTOMER' ? gt(appointment.startAt, agora) : undefined,
      ),
    )
    .returning({ id: appointment.id });

  if (linhas.length === 0) throw new NotFoundError('Agendamento não encontrado');
}
