import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { listActiveServices, listActiveStaff } from '@/db/repositories';
import { autorizar } from '@/domain/brain-contract/autorizar';
import { toApiError, invalidInput } from '@/lib/api-error';
import { abrirContexto, lerCorpoJson } from '@/lib/contexto-do-brain';

export const dynamic = 'force-dynamic';

const corpo = z.object({
  accountId: z.string().optional(),
  intent: z.string().min(1, 'intent é obrigatório'),
  externalReference: z.string().nullish(),
  slots: z
    .object({
      serviceName: z.string().optional(),
      staffName: z.string().optional(),
      sessionDate: z.string().optional(),
      sessionTime: z.string().optional(),
      appointmentId: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

/** POST /api/operation-candidates/authorize — valida a escolha sem gravar (dry-run). */
export async function POST(req: Request) {
  const ctx = await abrirContexto(req);
  if (!ctx.ok) return ctx.resposta;

  const parsed = corpo.safeParse(await lerCorpoJson(req));
  if (!parsed.success) return invalidInput(parsed.error.issues[0].message);
  const [servicos, equipe] = await Promise.all([
    listActiveServices(db, ctx.loja.id),
    listActiveStaff(db, ctx.loja.id),
  ]);

  try {
    const resposta = await autorizar(db, ctx.loja, servicos, equipe, parsed.data);
    return NextResponse.json(resposta, { headers: { 'Cache-Control': 'no-store' } });
  } catch (erro) {
    return toApiError(erro);
  }
}
