import { pgTable, uuid, text, integer, boolean, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { barbershop } from './barbershop';
import { staff } from './staff';

export const service = pgTable(
  'service',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    priceCents: integer('price_cents').notNull().default(0),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('service_barbershop_idx').on(t.barbershopId)],
);

export const staffService = pgTable(
  'staff_service',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id').notNull().references(() => service.id, { onDelete: 'cascade' }),
    durationMinutesOverride: integer('duration_minutes_override'),
  },
  (t) => [unique('staff_service_unique').on(t.staffId, t.serviceId)],
);
