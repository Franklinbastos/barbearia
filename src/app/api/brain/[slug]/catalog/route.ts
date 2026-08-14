import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { listActiveServices, listActiveStaff } from '@/db/repositories';
import { montarCatalogo } from '@/domain/brain-contract/catalogo';
import { abrirContexto } from '@/app/api/brain/contexto';

export const dynamic = 'force-dynamic';

/** GET /api/brain/[slug]/catalog — o que a barbearia sabe fazer, para o brain. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await abrirContexto(req, slug);
  if (!ctx.ok) return ctx.resposta;

  const [servicos, equipe] = await Promise.all([
    listActiveServices(db, ctx.loja.id),
    listActiveStaff(db, ctx.loja.id),
  ]);

  const catalogo = montarCatalogo(ctx.loja, servicos, equipe);
  return NextResponse.json(catalogo, { headers: { 'Cache-Control': 'no-store' } });
}
