import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { requireSession } from '@/lib/session';
import { getAvailability } from '@/domain/booking';
import { toApiError, invalidInput } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

/**
 * Grade de horários para o balcão logado.
 *
 * Difere da rota pública em duas coisas, e as duas são de propósito: o tenant vem
 * da sessão (nunca do slug da URL, que qualquer um edita) e a janela de
 * `maxAdvanceDays` não se aplica — ela existe para limitar o que o cliente marca
 * sozinho, não para impedir a barbearia de organizar a própria agenda.
 *
 * Sem rate limit: já exige sessão do painel.
 */
const query = z.object({
  serviceId: z.string().uuid('Serviço inválido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'A data deve estar no formato AAAA-MM-DD'),
  staffId: z.string().uuid().optional(),
});

export async function GET(req: Request) {
  const sessao = await requireSession();

  const url = new URL(req.url);
  const parsed = query.safeParse({
    serviceId: url.searchParams.get('serviceId') ?? undefined,
    date: url.searchParams.get('date') ?? undefined,
    staffId: url.searchParams.get('staffId') ?? undefined,
  });
  if (!parsed.success) return invalidInput(parsed.error.issues[0].message);

  try {
    const slots = await getAvailability(db, {
      barbershopId: sessao.barbershopId,
      serviceId: parsed.data.serviceId,
      staffId: parsed.data.staffId,
      date: parsed.data.date,
      enforceWindow: false,
    });

    return NextResponse.json({
      slots: slots.map((s) => ({
        startAt: s.start.toISOString(),
        staffId: s.staffId,
        staffName: s.staffName,
      })),
    });
  } catch (erro) {
    return toApiError(erro);
  }
}
