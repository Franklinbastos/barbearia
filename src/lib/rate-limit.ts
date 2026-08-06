import { sql } from 'drizzle-orm';
import { rateLimitBucket } from '@/db/schema';
import type { Db } from '@/db/repositories';

export async function checkRateLimit(
  db: Db,
  args: { key: string; limit: number; windowSeconds: number; now?: Date },
): Promise<{ allowed: boolean; remaining: number }> {
  const agora = args.now ?? new Date();
  const janelaMs = args.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(agora.getTime() / janelaMs) * janelaMs);

  const [linha] = await db
    .insert(rateLimitBucket)
    .values({ key: args.key, windowStart, hits: 1 })
    .onConflictDoUpdate({
      target: [rateLimitBucket.key, rateLimitBucket.windowStart],
      set: { hits: sql`${rateLimitBucket.hits} + 1` },
    })
    .returning({ hits: rateLimitBucket.hits });

  return { allowed: linha.hits <= args.limit, remaining: Math.max(0, args.limit - linha.hits) };
}

export function clientKey(req: Request, sufixo: string): string {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'desconhecido';
  return `${ip}:${sufixo}`;
}
