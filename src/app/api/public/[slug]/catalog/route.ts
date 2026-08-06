import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { staffService, staff } from '@/db/schema';
import { findBarbershopBySlug, listActiveServices, listActiveStaff } from '@/db/repositories';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loja = await findBarbershopBySlug(db, slug);
  if (!loja) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Barbearia não encontrada' }, { status: 404 });
  }

  const [servicos, equipe, vinculos] = await Promise.all([
    listActiveServices(db, loja.id),
    listActiveStaff(db, loja.id),
    db
      .select({ staffId: staffService.staffId, serviceId: staffService.serviceId })
      .from(staffService)
      .innerJoin(staff, eq(staff.id, staffService.staffId))
      .where(and(eq(staffService.barbershopId, loja.id), eq(staff.active, true))),
  ]);

  return NextResponse.json(
    {
      shop: { name: loja.name, timeZone: loja.timeZone, maxAdvanceDays: loja.maxAdvanceDays },
      services: servicos.map((s) => ({
        id: s.id, name: s.name, durationMinutes: s.durationMinutes, priceCents: s.priceCents,
      })),
      staff: equipe.map((b) => ({
        id: b.id,
        name: b.name,
        photoUrl: b.photoUrl,
        serviceIds: vinculos.filter((v) => v.staffId === b.id).map((v) => v.serviceId),
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
