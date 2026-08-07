import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { env } from '@/lib/env';
import { selectDueReminders, TETO_LEMBRETES } from '@/domain/reminders/select-due';
import { getSender, notifyOnce } from '@/notifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Lote de envio: paralelo o bastante para caber no tempo, pequeno o bastante
 *  para não estourar o limite de requisições do provider. */
const TAMANHO_DO_LOTE = 10;

/** Comparação em tempo constante, como em `lib/tokens.ts`. */
function segredoConfere(cabecalho: string | null): boolean {
  const recebido = Buffer.from(cabecalho ?? '');
  const esperado = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  if (recebido.length !== esperado.length) return false;
  return timingSafeEqual(recebido, esperado);
}

export async function GET(req: Request) {
  if (!segredoConfere(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // Antes do loop: se o envio estourar o `maxDuration`, a faxina do balde de
  // rate limit já aconteceu. É a única rotina que apaga essa tabela.
  await db.execute(
    sql`DELETE FROM rate_limit_bucket WHERE window_start < now() - interval '1 day'`,
  );

  const devidos = await selectDueReminders(db, {
    now: new Date(),
    windowMinutes: env.REMINDER_WINDOW_MINUTES,
  });

  if (devidos.length === TETO_LEMBRETES) {
    console.warn(
      `Teto de ${TETO_LEMBRETES} lembretes atingido nesta execução — pode haver fila pendente`,
    );
  }

  const sender = getSender();
  let enviados = 0;
  let pulados = 0;
  let falhas = 0;

  for (let i = 0; i < devidos.length; i += TAMANHO_DO_LOTE) {
    const lote = devidos.slice(i, i + TAMANHO_DO_LOTE);
    const resultados = await Promise.all(
      lote.map((item) => notifyOnce(db, { ...item, type: 'REMINDER', sender })),
    );
    for (const r of resultados) {
      if (r === 'SENT') enviados += 1;
      else if (r === 'SKIPPED') pulados += 1;
      else falhas += 1;
    }
  }

  console.info(`Lembretes: ${enviados} enviados, ${pulados} pulados, ${falhas} falharam`);

  return NextResponse.json({ enviados, pulados, falhas });
}
