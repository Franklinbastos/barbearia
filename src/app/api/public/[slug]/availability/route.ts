import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { findBarbershopBySlug } from '@/db/repositories';
import { getAvailability } from '@/domain/booking';
import { toApiError, invalidInput } from '@/lib/api-error';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const query = z.object({
  serviceId: z.string().uuid('serviceId inválido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date deve estar no formato YYYY-MM-DD'),
  staffId: z.string().uuid().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const url = new URL(req.url);
  const parsed = query.safeParse({
    serviceId: url.searchParams.get('serviceId') ?? undefined,
    date: url.searchParams.get('date') ?? undefined,
    staffId: url.searchParams.get('staffId') ?? undefined,
  });
  if (!parsed.success) return invalidInput(parsed.error.issues[0].message);

  // O slug é resolvido ANTES de contar. Com a contagem na frente e o slug cru
  // dentro da chave, um laço com slugs aleatórios criava uma chave nova por
  // requisição: o limite nunca disparava e o balde crescia sem teto.
  const loja = await findBarbershopBySlug(db, slug);
  if (!loja) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Barbearia não encontrada' }, { status: 404 });
  }

  const limite = await checkRateLimit(db, {
    key: clientKey(req, `avail:${loja.id}`),
    limit: 120,
    windowSeconds: 60,
  });
  if (!limite.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Muitas consultas. Espere um instante e tente de novo.' },
      { status: 429 },
    );
  }

  try {
    const slots = await getAvailability(db, {
      barbershopId: loja.id,
      serviceId: parsed.data.serviceId,
      staffId: parsed.data.staffId,
      date: parsed.data.date,
    });
    return NextResponse.json(
      {
        slots: slots.map((s) => ({
          startAt: s.start.toISOString(), staffId: s.staffId, staffName: s.staffName,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (erro) {
    return toApiError(erro);
  }
}
