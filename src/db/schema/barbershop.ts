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
    /**
     * Matiz da marca, 0–360, um dos doze da paleta (§3.4). Nulo é o padrão e
     * significa preto-e-branco: L e croma são nossos e travados, então o dono
     * escolhe **um número** e nenhuma escolha produz botão ilegível.
     */
    accentHue: integer('accent_hue'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('barbershop_slug_idx').on(t.slug)],
);
