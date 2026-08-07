import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/lib/env';
import * as schema from './schema';

/**
 * Ajuste para serverless: cada instância de função carrega o próprio pool, e o
 * `idle_timeout: null` padrão do postgres.js nunca fecha conexão ociosa. Com
 * `max: 5`, um punhado de instâncias mornas estoura o limite de conexões do
 * Neon e a página pública passa a dar 500 em massa. Uma conexão por instância,
 * devolvida em 20s, é o que a Vercel e o pooler do Neon esperam.
 */
export const OPCOES_DO_POOL = { max: 1, idle_timeout: 20, connect_timeout: 10 } as const;

export function createDb(connectionString: string) {
  const client = postgres(connectionString, { ...OPCOES_DO_POOL });
  return drizzle(client, { schema });
}

const client = postgres(env.DATABASE_URL, { ...OPCOES_DO_POOL });

export const db = drizzle(client, { schema });

/** Fecha o pool. Só os testes usam — em produção o processo morre com a função. */
export async function closeDb() {
  await client.end();
}
