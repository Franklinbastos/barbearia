import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// DATABASE_URL_TEST tem precedência: é assim que a suíte migra o banco de teste
// sem tocar no de desenvolvimento. Sem isso, `DATABASE_URL_TEST=... tsx src/db/migrate.ts`
// migraria silenciosamente o banco errado.
const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL não definida');

const client = postgres(url, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: './drizzle' });
await client.end();
console.log('Migrations aplicadas.');
