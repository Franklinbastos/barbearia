import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

export const barbershop = pgTable(
  'barbershop',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    timeZone: text('time_zone').notNull().default('America/Sao_Paulo'),
    slotMinutes: integer('slot_minutes').notNull().default(30),
    minLeadMinutes: integer('min_lead_minutes').notNull().default(60),
    maxAdvanceDays: integer('max_advance_days').notNull().default(30),
    phone: text('phone'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('barbershop_slug_idx').on(t.slug)],
);
