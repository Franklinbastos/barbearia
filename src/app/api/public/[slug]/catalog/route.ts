import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { findBarbershopBySlug } from '@/db/repositories';
import { carregarCatalogo } from '@/app/b/[slug]/catalogo';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loja = await findBarbershopBySlug(db, slug);
  if (!loja) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Barbearia não encontrada' }, { status: 404 });
  }

  const catalogo = await carregarCatalogo(db, loja);

  return NextResponse.json(catalogo, { headers: { 'Cache-Control': 'no-store' } });
}
