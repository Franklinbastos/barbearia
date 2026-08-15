import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { barbershop } from './barbershop';
import { appointment } from './appointment';

export const notificationLog = pgTable(
  'notification_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    appointmentId: uuid('appointment_id').notNull().references(() => appointment.id, { onDelete: 'cascade' }),
    // `RESCHEDULE` entra em 15/08/2026 com o remarcar sem cancelar. A coluna é
    // `text`, então o valor novo não custa migration: o enum vive no TypeScript.
    type: text('type', {
      enum: ['CONFIRMATION', 'REMINDER', 'CANCELLATION', 'RESCHEDULE'],
    }).notNull(),
    status: text('status', { enum: ['SENT', 'FAILED'] }).notNull(),
    providerMessageId: text('provider_message_id'),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  /**
   * **O único por `(appointmentId, type)` não pode ganhar uma terceira coluna.**
   * Ele é a trava de reserva do `notifications/notify.ts`, que faz
   * `ON CONFLICT (appointment_id, type)` — e o Postgres só infere esse alvo se
   * existir índice único exatamente sobre essas duas colunas. Acrescentar
   * `created_at` aqui derruba confirmação, lembrete e cancelamento inteiros com
   * `42P10: there is no unique or exclusion constraint matching the ON CONFLICT
   * specification`.
   *
   * Remarcar duas vezes não precisa de duas linhas: `notify.ts` já trata a linha
   * como fila de uma tentativa por assunto — nasce, falha, e é retomada. O
   * `rescheduleAppointment` segue o mesmo desenho e **atualiza** a linha
   * pendente em vez de empilhar outra, então a última remarcação é a que o
   * envio vai encontrar quando o template da Meta sair da burocracia.
   */
  (t) => [unique('notification_log_unique').on(t.appointmentId, t.type)],
);
