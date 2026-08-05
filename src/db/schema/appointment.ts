import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { barbershop } from './barbershop';
import { staff } from './staff';
import { service } from './service';
import { customer } from './customer';

export const appointment = pgTable(
  'appointment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'restrict' }),
    customerId: uuid('customer_id').notNull().references(() => customer.id, { onDelete: 'restrict' }),
    serviceId: uuid('service_id').references(() => service.id, { onDelete: 'set null' }),
    serviceNameSnapshot: text('service_name_snapshot').notNull(),
    servicePriceCentsSnapshot: integer('service_price_cents_snapshot').notNull(),
    serviceDurationMinutesSnapshot: integer('service_duration_minutes_snapshot').notNull(),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    status: text('status', { enum: ['BOOKED', 'DONE', 'CANCELED', 'NO_SHOW'] }).notNull().default('BOOKED'),
    origin: text('origin', { enum: ['PUBLIC', 'PANEL', 'BOT'] }).notNull().default('PUBLIC'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
  },
  (t) => [
    index('appointment_staff_start_idx').on(t.staffId, t.startAt),
    index('appointment_barbershop_start_idx').on(t.barbershopId, t.startAt),
  ],
);
