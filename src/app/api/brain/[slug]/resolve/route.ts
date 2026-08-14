import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { listActiveServices, listActiveStaff } from '@/db/repositories';
import { resolverCandidatos } from '@/domain/brain-contract/resolver';
import { toApiError, invalidInput } from '@/lib/api-error';
import { abrirContexto, lerCorpoJson, contaConfere, contaInvalida } from '@/app/api/brain/contexto';

export const dynamic = 'force-dynamic';

const corpo = z.object({
  accountId: z.string().optional(),
  slotToResolve: z.string().min(1, 'slotToResolve é obrigatório'),
  resolverKey: z.string().optional(),
  slots: z
    .object({
      serviceName: z.string().optional(),
      staffName: z.string().optional(),
      sessionDate: z.string().optional(),
    })
    .passthrough()
    .optional(),
  limit: z.number().int().positive().nullish(),
});

/** POST /api/brain/[slug]/resolve — candidatos para o slot que falta. */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await abrirContexto(req, slug);
  if (!ctx.ok) return ctx.resposta;

  const parsed = corpo.safeParse(await lerCorpoJson(req));
  if (!parsed.success) return invalidInput(parsed.error.issues[0].message);
  if (!contaConfere(parsed.data.accountId, ctx.loja)) return contaInvalida();

  const [servicos, equipe] = await Promise.all([
    listActiveServices(db, ctx.loja.id),
    listActiveStaff(db, ctx.loja.id),
  ]);

  try {
    const resposta = await resolverCandidatos(db, ctx.loja, servicos, equipe, parsed.data);
    return NextResponse.json(resposta, { headers: { 'Cache-Control': 'no-store' } });
  } catch (erro) {
    return toApiError(erro);
  }
}
