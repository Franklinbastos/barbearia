import { pgTable, uuid, text, boolean, integer, time, smallint, timestamp, index } from 'drizzle-orm/pg-core';
import { barbershop } from './barbershop';

export const staff = pgTable(
  'staff',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    userId: text('user_id'),
    name: text('name').notNull(),
    photoUrl: text('photo_url'),
    role: text('role', { enum: ['OWNER', 'BARBER'] }).notNull().default('BARBER'),
    active: boolean('active').notNull().default(true),
    /**
     * Percentual de comissão do barbeiro, inteiro de 0 a 100. Nulo = barbeiro
     * sem comissão (dono que não tira, ou quem aluga a cadeira), e a linha some
     * do relatório em vez de aparecer zerada — nulo não é zero.
     */
    commissionPercent: integer('commission_percent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('staff_barbershop_idx').on(t.barbershopId)],
);

export const workingHours = pgTable(
  'working_hours',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
    weekday: smallint('weekday').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
  },
  (t) => [index('working_hours_staff_weekday_idx').on(t.staffId, t.weekday)],
);

export const timeOff = pgTable(
  'time_off',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    barbershopId: uuid('barbershop_id').notNull().references(() => barbershop.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    reason: text('reason'),
  },
  (t) => [index('time_off_staff_start_idx').on(t.staffId, t.startAt)],
);
