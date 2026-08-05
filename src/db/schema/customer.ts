import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { barbershop } from './barbershop';

export const customer = pgTable(
  'customer',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('customer_phone_unique').on(t.barbershopId, t.phone)],
);
