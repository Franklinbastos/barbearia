import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { barbershop } from './barbershop';
import { appointment } from './appointment';

export const notificationLog = pgTable(
  'notification_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    appointmentId: uuid('appointment_id').notNull().references(() => appointment.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['CONFIRMATION', 'REMINDER', 'CANCELLATION'] }).notNull(),
    status: text('status', { enum: ['SENT', 'FAILED'] }).notNull(),
    providerMessageId: text('provider_message_id'),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('notification_log_unique').on(t.appointmentId, t.type)],
);
