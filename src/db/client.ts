import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 5 });
  return drizzle(client, { schema });
}

export const db = createDb(env.DATABASE_URL);
