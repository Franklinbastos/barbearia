import type { drizzle } from 'drizzle-orm/postgres-js';
import type * as schema from '@/db/schema';

export type Db = ReturnType<typeof drizzle<typeof schema>>;
