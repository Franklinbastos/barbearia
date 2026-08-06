import { pgTable, text, integer, timestamp, primaryKey } from 'drizzle-orm/pg-core';

export const rateLimitBucket = pgTable(
  'rate_limit_bucket',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    hits: integer('hits').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);
