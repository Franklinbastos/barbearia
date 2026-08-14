import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { listActiveServices, listActiveStaff } from '@/db/repositories';
import { executar } from '@/domain/brain-contract/executar';
import type { ResultadoDaAcao } from '@/domain/brain-contract/tipos';
import { toApiError, invalidInput } from '@/lib/api-error';
import { abrirContexto, lerCorpoJson, contaConfere, contaInvalida } from '@/app/api/brain/contexto';

export const dynamic = 'force-dynamic';

const corpo = z.object({
  accountId: z.string().optional(),
  actionName: z.string().min(1, 'actionName é obrigatório'),
  idempotencyKey: z.string().min(1, 'idempotencyKey é obrigatório'),
  externalReference: z.string().nullish(),
  payload: z
    .object({
      serviceName: z.string().optional(),
      staffName: z.string().optional(),
      sessionDate: z.string().optional(),
      sessionTime: z.string().optional(),
      clientName: z.string().optional(),
      customerPhone: z.string().optional(),
      appointmentId: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

/** Códigos de recusa por entrada malformada → 400; recusa de negócio → 409. */
const RECUSA_DE_ENTRADA = new Set([
  'MISSING_IDEMPOTENCY_KEY',
  'MISSING_CUSTOMER',
  'SERVICE_NOT_FOUND',
  'INVALID_DATETIME',
  'MISSING_APPOINTMENT',
  'UNKNOWN_ACTION',
]);

function statusHttp(resultado: ResultadoDaAcao): number {
  if (resultado.status === 'CREATED') return 201;
  if (resultado.status === 'CANCELED') return 200;
  return RECUSA_DE_ENTRADA.has(resultado.code ?? '') ? 400 : 409;
}

/** POST /api/brain/[slug]/execute — cria (origin BOT) ou cancela de verdade. */
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
    const resultado = await executar(db, ctx.loja, servicos, equipe, parsed.data);
    return NextResponse.json(resultado, { status: statusHttp(resultado) });
  } catch (erro) {
    return toApiError(erro);
  }
}
