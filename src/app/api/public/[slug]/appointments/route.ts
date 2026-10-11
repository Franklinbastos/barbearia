import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { findBarbershopBySlug, listActiveStaff } from '@/db/repositories';
import { createAppointment } from '@/domain/booking';
import { toApiError, invalidInput } from '@/lib/api-error';
import { buildManageUrl } from '@/lib/tokens';
import { notifyOnce, getSender, afterResponse } from '@/notifications';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Reservas por IP, por barbearia, por dia. Folga para uma família ou um salão com Wi-Fi compartilhado. */
const LIMITE_DIARIO_POR_IP = 20;

/** Controle, formatação invisível e afins — nada disso é nome de gente. */
const CARACTERE_DE_CONTROLE = /\p{C}/u;
/** O nome vai dentro da mensagem de WhatsApp da barbearia: link, nunca. */
const PARECE_LINK = /(https?:\/\/|www\.|@|\S+\.(com|net|org|br|io|me|co|xyz|link|app)\b)/i;

const body = z.object({
  serviceId: z.string().uuid('Serviço inválido'),
  staffId: z.string().uuid().optional(),
  startAt: z.string().datetime('Horário inválido'),
  name: z
    .string()
    .trim()
    .min(2, 'Informe seu nome')
    .max(80, 'Nome muito longo')
    .refine((v) => !CARACTERE_DE_CONTROLE.test(v), 'Nome com caracteres inválidos')
    .refine((v) => !PARECE_LINK.test(v), 'Informe só o seu nome, sem links'),
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
  // Só a janela de 10 min deixava ~1.400 reservas por IP num dia: dá para lotar
  // a semana da barbearia trocando o telefone a cada pedido. Até a confirmação
  // pelo WhatsApp existir, o teto diário é o que segura um atacante de um IP só.
  const porIpNoDia = await checkRateLimit(db, {
    key: clientKey(req, `book-dia:${slug}`), limit: LIMITE_DIARIO_POR_IP, windowSeconds: 86_400,
  });
  const porTelefone = await checkRateLimit(db, {
    key: `phone:${dados.phone}:${slug}`, limit: 5, windowSeconds: 3600,
  });
  if (!porIp.allowed || !porIpNoDia.allowed || !porTelefone.allowed) {
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

    afterResponse(
      () =>
        notifyOnce(db, {
          barbershopId: loja.id,
          appointmentId: criado.appointmentId,
          type: 'CONFIRMATION',
          sender: getSender(),
        }),
      'Falha ao notificar confirmação',
    );

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
