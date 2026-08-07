import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/db/schema';
import { garantirBancoDeTeste } from '../../vitest.setup';

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Todas as tabelas da aplicação, inclusive as do Better-Auth (`user`,
 * `session`, `account`, `verification`) e o balde do rate limit. Um único
 * TRUNCATE com CASCADE resolve as chaves estrangeiras, então a ordem aqui é só
 * de leitura. `drizzle.__drizzle_migrations` fica de fora de propósito.
 */
const TABELAS = [
  '"notification_log"',
  '"appointment"',
  '"customer"',
  '"staff_service"',
  '"time_off"',
  '"working_hours"',
  '"service"',
  '"staff"',
  '"barbershop"',
  '"rate_limit_bucket"',
  '"session"',
  '"account"',
  '"verification"',
  '"user"',
].join(', ');

export async function withTestDb<T>(fn: (db: TestDb, sql: postgres.Sql) => Promise<T>): Promise<T> {
  const url = garantirBancoDeTeste(process.env.DATABASE_URL!);
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema });
  try {
    return await fn(db, sql);
  } finally {
    await sql.unsafe(`TRUNCATE ${TABELAS} RESTART IDENTITY CASCADE`);
    await sql.end();
  }
}
