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

/**
 * Teto por parte da chave. Um IPv6 com zona cabe folgado em 64 e um UUID de
 * barbearia também: o corte só existe para o cabeçalho, que vem do cliente e
 * pode ter qualquer tamanho — chave gigante engorda o índice do balde à toa.
 */
const MAX_POR_PARTE = 64;

/**
 * De qual cabeçalho sai o IP do cliente. Depende de quem está na frente do app,
 * e só vale se esse proxy **sobrescrever** o cabeçalho — senão o próprio cliente
 * o inventa a cada pedido e nunca bate no limite:
 *
 * - Vercel: `x-forwarded-for` (padrão). A plataforma reescreve e o 1º item é o cliente.
 * - Cloudflare: `cf-connecting-ip`. No `x-forwarded-for` de lá o cliente injeta o 1º item.
 * - VPS atrás de Caddy/nginx: o cabeçalho que o proxy define, em geral `x-real-ip`.
 */
export const CABECALHO_DE_IP_PADRAO = 'x-forwarded-for';

function cabecalhoDeIp(): string {
  return (process.env.TRUSTED_IP_HEADER ?? '').trim().toLowerCase() || CABECALHO_DE_IP_PADRAO;
}

export function clientKey(req: Request, sufixo: string): string {
  const bruto = (req.headers.get(cabecalhoDeIp()) ?? '').split(',')[0].trim();
  const ip = (bruto || 'desconhecido').slice(0, MAX_POR_PARTE);
  return `${ip}:${sufixo.slice(0, MAX_POR_PARTE)}`;
}
