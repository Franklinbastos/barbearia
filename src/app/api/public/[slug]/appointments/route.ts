import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { findBarbershopBySlug, listActiveStaff } from '@/db/repositories';
import { createAppointment } from '@/domain/booking';
import { toApiError, invalidInput } from '@/lib/api-error';
import { buildManageUrl } from '@/lib/tokens';
import { notifyOnce, getSender } from '@/notifications';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';

const body = z.object({
  serviceId: z.string().uuid('Serviço inválido'),
  staffId: z.string().uuid().optional(),
  startAt: z.string().datetime('Horário inválido'),
  name: z.string().trim().min(2, 'Informe seu nome'),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length >= 10 && v.length <= 13, 'Informe um telefone com DDD'),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let dados;
  try {
    dados = body.parse(await req.json());
  } catch (erro) {
    if (erro instanceof z.ZodError) return invalidInput(erro.issues[0].message);
    return invalidInput('Não foi possível ler o pedido');
  }

  const loja = await findBarbershopBySlug(db, slug);
  if (!loja) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Barbearia não encontrada' }, { status: 404 });
  }

  const porIp = await checkRateLimit(db, {
    key: clientKey(req, `book:${slug}`), limit: 10, windowSeconds: 600,
  });
  const porTelefone = await checkRateLimit(db, {
    key: `phone:${dados.phone}:${slug}`, limit: 5, windowSeconds: 3600,
  });
  if (!porIp.allowed || !porTelefone.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Você já fez vários agendamentos agora há pouco. Fale com a barbearia.' },
      { status: 429 },
    );
  }

  try {
    const criado = await createAppointment(db, {
      barbershopId: loja.id,
      serviceId: dados.serviceId,
      staffId: dados.staffId,
      startAt: new Date(dados.startAt),
      customer: { name: dados.name, phone: dados.phone },
      origin: 'PUBLIC',
    });

    const equipe = await listActiveStaff(db, loja.id);
    const barbeiro = equipe.find((b) => b.id === criado.staffId);

    void notifyOnce(db, {
      barbershopId: loja.id,
      appointmentId: criado.appointmentId,
      type: 'CONFIRMATION',
      sender: getSender(),
    }).catch((erro) => console.error('Falha ao notificar confirmação', erro));

    return NextResponse.json(
      {
        appointmentId: criado.appointmentId,
        manageUrl: buildManageUrl(criado.appointmentId),
        startAt: criado.startAt.toISOString(),
        staffName: barbeiro?.name ?? '',
      },
      { status: 201 },
    );
  } catch (erro) {
    return toApiError(erro);
  }
}
