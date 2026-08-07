import { and, eq } from 'drizzle-orm';
import { appointment, barbershop, customer, notificationLog, staff } from '@/db/schema';
import type { Db } from '@/db/repositories';
import { buildManageUrl } from '@/lib/tokens';
import { renderCancellation, renderConfirmation, renderReminder } from './templates';
import type { NotificationSender } from './sender';

export type NotificationType = 'CONFIRMATION' | 'REMINDER' | 'CANCELLATION';

const renderizadores = {
  CONFIRMATION: renderConfirmation,
  REMINDER: renderReminder,
  CANCELLATION: renderCancellation,
} as const;

/**
 * Reserva a linha de `notification_log` ANTES do envio, usando a unique
 * `(appointmentId, type)` como trava.
 *
 * - Ninguém pegou ainda: o INSERT ganha e devolve a linha.
 * - Alguém já pegou e deu certo: o INSERT conflita, o UPDATE não acha linha
 *   `FAILED` e a reserva falha — o chamador devolve `SKIPPED`.
 * - A tentativa anterior falhou: o UPDATE retoma a linha. Dois cron retomando
 *   ao mesmo tempo não passam os dois: o segundo espera o lock e, quando olha
 *   de novo, o status já não é `FAILED`.
 *
 * A linha reservada nasce como `SENT` sem `providerMessageId`: é o estado
 * "meu, estou mandando". Quem morre no meio do envio deixa a notificação sem
 * reenvio — de propósito, porque mandar duas mensagens pelo WhatsApp da
 * barbearia é pior que não mandar a segunda.
 */
async function reservar(
  db: Db,
  args: { barbershopId: string; appointmentId: string; type: NotificationType },
): Promise<boolean> {
  const [novo] = await db
    .insert(notificationLog)
    .values({
      barbershopId: args.barbershopId,
      appointmentId: args.appointmentId,
      type: args.type,
      status: 'SENT',
    })
    .onConflictDoNothing({ target: [notificationLog.appointmentId, notificationLog.type] })
    .returning({ id: notificationLog.id });
  if (novo) return true;

  const [retomado] = await db
    .update(notificationLog)
    .set({ status: 'SENT', providerMessageId: null, error: null, sentAt: new Date() })
    .where(
      and(
        eq(notificationLog.barbershopId, args.barbershopId),
        eq(notificationLog.appointmentId, args.appointmentId),
        eq(notificationLog.type, args.type),
        eq(notificationLog.status, 'FAILED'),
      ),
    )
    .returning({ id: notificationLog.id });

  return Boolean(retomado);
}

export async function notifyOnce(
  db: Db,
  args: { barbershopId: string; appointmentId: string; type: NotificationType; sender: NotificationSender },
): Promise<'SENT' | 'SKIPPED' | 'FAILED'> {
  const [dados] = await db
    .select({
      startAt: appointment.startAt,
      serviceName: appointment.serviceNameSnapshot,
      customerName: customer.name,
      customerPhone: customer.phone,
      staffName: staff.name,
      shopName: barbershop.name,
      timeZone: barbershop.timeZone,
    })
    .from(appointment)
    .innerJoin(customer, eq(customer.id, appointment.customerId))
    .innerJoin(staff, eq(staff.id, appointment.staffId))
    .innerJoin(barbershop, eq(barbershop.id, appointment.barbershopId))
    .where(
      and(eq(appointment.barbershopId, args.barbershopId), eq(appointment.id, args.appointmentId)),
    )
    .limit(1);

  if (!dados) return 'FAILED';

  const mensagem = renderizadores[args.type]({
    ...dados,
    manageUrl: buildManageUrl(args.appointmentId),
  });

  if (!(await reservar(db, args))) return 'SKIPPED';

  async function concluir(valores: {
    status: 'SENT' | 'FAILED';
    providerMessageId?: string | null;
    error?: string | null;
  }) {
    await db
      .update(notificationLog)
      .set({ ...valores, sentAt: new Date() })
      .where(
        and(
          eq(notificationLog.barbershopId, args.barbershopId),
          eq(notificationLog.appointmentId, args.appointmentId),
          eq(notificationLog.type, args.type),
        ),
      );
  }

  try {
    const { providerMessageId } = await args.sender.send(dados.customerPhone, mensagem);
    await concluir({ status: 'SENT', providerMessageId, error: null });
    return 'SENT';
  } catch (erro) {
    await concluir({
      status: 'FAILED',
      providerMessageId: null,
      error: erro instanceof Error ? erro.message : String(erro),
    });
    return 'FAILED';
  }
}
