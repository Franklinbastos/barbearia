import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { findBarbershopByInternalApiKey } from '@/db/repositories';
import type { LojaDoBrain } from '@/domain/brain-contract/tipos';

/**
 * Wiring comum dos quatro endpoints do brain (`/api/operation-candidates/*` e
 * `/api/external-actions/execute`): guarda por chave e resolução do tenant.
 * Fora do domínio de propósito — `catalogo.ts`/`resolver.ts`/etc. continuam
 * testáveis sem `env` nem banco.
 *
 * Este arquivo não é uma rota — só `route.ts` vira endpoint.
 */
const HEADER_DA_CHAVE = 'x-internal-api-key';

export type Contexto =
  | { ok: true; loja: LojaDoBrain }
  | { ok: false; resposta: NextResponse };

/**
 * Tenant por chave, não por slug na URL: cada barbearia tem a própria
 * `X-Internal-Api-Key`, e essa chave é o único sinal de conta — o `GET
 * catalog` nem tem corpo para carregar outra coisa. Chave ausente e chave que
 * não bate com nenhuma barbearia dão a mesma resposta 401, para não vazar se
 * a chave existe.
 */
export async function abrirContexto(req: Request): Promise<Contexto> {
  const chave = req.headers.get(HEADER_DA_CHAVE);
  if (!chave || chave.trim() === '') {
    return { ok: false, resposta: naoAutorizado() };
  }

  const loja = await findBarbershopByInternalApiKey(db, chave);
  if (!loja) {
    return { ok: false, resposta: naoAutorizado() };
  }

  return { ok: true, loja };
}

function naoAutorizado(): NextResponse {
  return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
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
 * O contrato manda `accountId` no corpo; a chave já resolveu o tenant. Os
 * dois têm que apontar para a mesma barbearia — divergência é o brain
 * configurado errado (chave de uma conta, `accountId` de outra), não ação em
 * dado alheio. `accountId` ausente também recusa: o schema o exige.
 */
export function contaConfere(accountId: unknown, loja: LojaDoBrain): boolean {
  return typeof accountId === 'string' && accountId === loja.slug;
}

export function contaInvalida(): NextResponse {
  return NextResponse.json(
    { error: 'INVALID_INPUT', message: 'accountId ausente ou diferente da barbearia da chave' },
    { status: 400 },
  );
}
