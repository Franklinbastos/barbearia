import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { env } from '@/lib/env';
import { selectDueReminders } from '@/domain/reminders/select-due';
import { getSender, notifyOnce } from '@/notifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const devidos = await selectDueReminders(db, {
    now: new Date(),
    windowMinutes: env.REMINDER_WINDOW_MINUTES,
  });

  if (devidos.length === 500) {
    console.warn('Teto de 500 lembretes atingido nesta execução — pode haver fila pendente');
  }

  const sender = getSender();
  let enviados = 0;
  let pulados = 0;
  let falhas = 0;

  for (const item of devidos) {
    const r = await notifyOnce(db, { ...item, type: 'REMINDER', sender });
    if (r === 'SENT') enviados += 1;
    else if (r === 'SKIPPED') pulados += 1;
    else falhas += 1;
  }

  console.info(`Lembretes: ${enviados} enviados, ${pulados} pulados, ${falhas} falharam`);
  return NextResponse.json({ enviados, pulados, falhas });
}
