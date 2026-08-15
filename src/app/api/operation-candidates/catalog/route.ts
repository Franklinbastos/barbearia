import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { listActiveServices, listActiveStaff } from '@/db/repositories';
import { montarCatalogo } from '@/domain/brain-contract/catalogo';
import { abrirContexto } from '@/lib/contexto-do-brain';

export const dynamic = 'force-dynamic';

/**
 * GET /api/operation-candidates/catalog — o que a barbearia sabe fazer, para
 * o brain. Sem corpo e sem slug na URL: o tenant é só a `X-Internal-Api-Key`.
 */
export async function GET(req: Request) {
  const ctx = await abrirContexto(req);
  if (!ctx.ok) return ctx.resposta;

  const [servicos, equipe] = await Promise.all([
    listActiveServices(db, ctx.loja.id),
    listActiveStaff(db, ctx.loja.id),
  ]);

  const catalogo = montarCatalogo(ctx.loja, servicos, equipe);
  return NextResponse.json(catalogo, { headers: { 'Cache-Control': 'no-store' } });
}
