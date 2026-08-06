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

export async function notifyOnce(
  db: Db,
  args: { barbershopId: string; appointmentId: string; type: NotificationType; sender: NotificationSender },
): Promise<'SENT' | 'SKIPPED' | 'FAILED'> {
  const [jaEnviado] = await db
    .select({ id: notificationLog.id })
    .from(notificationLog)
    .where(
      and(
        eq(notificationLog.appointmentId, args.appointmentId),
        eq(notificationLog.type, args.type),
        eq(notificationLog.status, 'SENT'),
      ),
    )
    .limit(1);
  if (jaEnviado) return 'SKIPPED';

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

  async function registrar(valores: {
    status: 'SENT' | 'FAILED';
    providerMessageId?: string;
    error?: string;
  }) {
    await db
      .insert(notificationLog)
      .values({
        barbershopId: args.barbershopId,
        appointmentId: args.appointmentId,
        type: args.type,
        ...valores,
      })
      .onConflictDoUpdate({
        target: [notificationLog.appointmentId, notificationLog.type],
        set: { ...valores, sentAt: new Date() },
      });
  }

  try {
    const { providerMessageId } = await args.sender.send(dados.customerPhone, mensagem);
    await registrar({ status: 'SENT', providerMessageId });
    return 'SENT';
  } catch (erro) {
    await registrar({ status: 'FAILED', error: erro instanceof Error ? erro.message : String(erro) });
    return 'FAILED';
  }
}
