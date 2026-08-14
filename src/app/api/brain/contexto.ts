import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { env } from '@/lib/env';
import { findBarbershopBySlug } from '@/db/repositories';
import { conferirChaveDoBrain } from '@/domain/brain-contract/guarda';
import type { LojaDoBrain } from '@/domain/brain-contract/tipos';

/**
 * Wiring comum dos endpoints do brain: guarda por API-key e resolução do
 * tenant. Mantido fora dos `route.ts` para não repetir, e fora do domínio para
 * que `guarda.ts`/`catalogo.ts` continuem testáveis sem `env` nem banco.
 *
 * Este arquivo não é uma rota — só `route.ts` vira endpoint; helpers colocados
 * ao lado são ignorados pelo roteador do Next.
 */
const HEADER_DA_CHAVE = 'x-brain-api-key';

export type Contexto =
  | { ok: true; loja: LojaDoBrain }
  | { ok: false; resposta: NextResponse };

/** Multi-tenant: o tenant é o `slug` no path, como nas rotas públicas. */
export async function abrirContexto(req: Request, slug: string): Promise<Contexto> {
  // Auth antes do tenant: quem não tem a chave nem fica sabendo se a barbearia existe.
  if (!conferirChaveDoBrain(req.headers.get(HEADER_DA_CHAVE), env.BRAIN_API_KEY)) {
    return { ok: false, resposta: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }) };
  }

  const loja = await findBarbershopBySlug(db, slug);
  if (!loja) {
    return {
      ok: false,
      resposta: NextResponse.json(
        { error: 'NOT_FOUND', message: 'Barbearia não encontrada' },
        { status: 404 },
      ),
    };
  }

  return { ok: true, loja };
}

/** Lê o corpo JSON; devolve `null` (em vez de estourar) quando vier quebrado. */
export async function lerCorpoJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * O contrato manda `accountId` no corpo; o path manda o `slug`. Os dois têm que
 * apontar para a mesma barbearia — divergência é pedido malformado, não ação em
 * dado alheio. `accountId` ausente também recusa: o schema o exige.
 */
export function contaConfere(accountId: unknown, loja: LojaDoBrain): boolean {
  return typeof accountId === 'string' && accountId === loja.slug;
}

export function contaInvalida(): NextResponse {
  return NextResponse.json(
    { error: 'INVALID_INPUT', message: 'accountId ausente ou diferente da barbearia do path' },
    { status: 400 },
  );
}
