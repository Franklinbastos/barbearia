import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { db } from '@/db/client';
import { findBarbershopBySlug } from '@/db/repositories';
import { getAvailability, bookingWindowLimit } from '@/domain/booking';
import { toApiError, invalidInput } from '@/lib/api-error';
import { checkRateLimit, clientKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Quais dias da janela têm vaga — a única adição de backend que muda o **número
 * de toques** do cliente.
 *
 * Sem ela, saber que sexta não tem custa abrir sexta, esperar o fetch, ler
 * "Nenhum horário livre", abrir sábado, esperar de novo. Com ela, a tira já
 * nasce com o ponto certo em cada ficha e o botão "Ver o próximo dia com vaga"
 * responde sem uma ida nova ao servidor.
 *
 * A resposta é sempre **cortada pela janela da loja**: nunca antes de hoje,
 * nunca depois de `maxAdvanceDays`. Quem pede um ano inteiro recebe o que a
 * loja aceita agendar, e não um erro.
 */
const query = z.object({
  serviceId: z.string().uuid('serviceId inválido'),
  staffId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from deve estar no formato YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to deve estar no formato YYYY-MM-DD'),
});

/**
 * Teto de dias por chamada. A tira pede 14; o limite existe porque cada dia é
 * uma volta de `getAvailability` no banco, e um `to` de 2099 viraria um
 * varredor de conexões com uma URL só.
 */
const MAXIMO_DE_DIAS = 31;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const url = new URL(req.url);
  const parsed = query.safeParse({
    serviceId: url.searchParams.get('serviceId') ?? undefined,
    staffId: url.searchParams.get('staffId') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
  });
  if (!parsed.success) return invalidInput(parsed.error.issues[0].message);

  // Mesma ordem da rota de horários: resolver o slug ANTES de contar, senão um
  // laço com slugs aleatórios cria uma chave de balde nova por requisição.
  const loja = await findBarbershopBySlug(db, slug);
  if (!loja) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: 'Barbearia não encontrada' },
      { status: 404 },
    );
  }

  const limite = await checkRateLimit(db, {
    key: clientKey(req, `dias:${loja.id}`),
    // Bem abaixo do limite da rota de horários: cada chamada aqui vale por até
    // 31 daquelas.
    limit: 20,
    windowSeconds: 60,
  });
  if (!limite.allowed) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Muitas consultas. Espere um instante e tente de novo.' },
      { status: 429 },
    );
  }

  const agora = new Date();
  const hoje = DateTime.fromJSDate(agora).setZone(loja.timeZone).startOf('day');
  const teto = bookingWindowLimit(loja, agora);

  const pedido = {
    de: DateTime.fromISO(parsed.data.from, { zone: loja.timeZone }).startOf('day'),
    ate: DateTime.fromISO(parsed.data.to, { zone: loja.timeZone }).startOf('day'),
  };
  if (!pedido.de.isValid || !pedido.ate.isValid) return invalidInput('Data inválida');

  const inicio = pedido.de < hoje ? hoje : pedido.de;
  const fim = pedido.ate > teto ? teto : pedido.ate;

  const datas: string[] = [];
  for (let dia = inicio; dia <= fim && datas.length < MAXIMO_DE_DIAS; dia = dia.plus({ days: 1 })) {
    datas.push(dia.toISODate()!);
  }

  try {
    const days: { date: string; hasSlots: boolean }[] = [];
    // Em série, e não `Promise.all`: o pool da função tem uma conexão só, e 31
    // consultas concorrentes nela viram fila com cara de lentidão.
    for (const date of datas) {
      const slots = await getAvailability(db, {
        barbershopId: loja.id,
        serviceId: parsed.data.serviceId,
        staffId: parsed.data.staffId,
        date,
        // O mesmo instante para a janela inteira: sem isto, um dia calculado
        // às 23:59:59 e o seguinte às 00:00:00 discordam sobre que dia é hoje.
        now: agora,
      });
      days.push({ date, hasSlots: slots.length > 0 });
    }

    return NextResponse.json({ days }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (erro) {
    return toApiError(erro);
  }
}
