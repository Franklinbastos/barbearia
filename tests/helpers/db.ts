import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/db/schema';

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export async function withTestDb<T>(fn: (db: TestDb, sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(sql, { schema });
  try {
    return await fn(db, sql);
  } finally {
    await sql`TRUNCATE notification_log, appointment, customer, staff_service, time_off, working_hours, service, staff, barbershop, rate_limit_bucket RESTART IDENTITY CASCADE`;
    await sql.end();
  }
}
