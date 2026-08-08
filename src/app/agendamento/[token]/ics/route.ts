import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { appointment, barbershop, staff } from '@/db/schema';
import { verifyManageToken } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

/**
 * Convite de calendário do horário marcado.
 *
 * É **rota**, e não um `data:` URI montado na página: no Safari do iOS o
 * `.ics` por `data:` não abre confiável, e o iPhone é exatamente onde o cliente
 * está quando recebe o link. Uma rota custa ~1h e funciona em todo lugar.
 *
 * A autorização é o mesmo token assinado da página de gerenciar: quem tem o
 * link tem o horário, e nada além dele.
 */

/** `\`, `;`, `,` e quebra de linha são sintaxe no iCalendar — todos escapam. */
function escapar(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** `20260907T170000Z` — o formato UTC básico, o único que todo leitor aceita. */
function instante(data: Date): string {
  return data.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Dobra a linha em 75 octetos, como manda o RFC 5545: a continuação começa com
 * um espaço. A conta é em **bytes**, não em caracteres — "João" ocupa 5.
 */
function dobrar(linha: string): string {
  const bytes = Buffer.from(linha, 'utf8');
  if (bytes.length <= 75) return linha;

  const partes: string[] = [];
  let inicio = 0;
  let limite = 75;
  while (inicio < bytes.length) {
    let fim = Math.min(inicio + limite, bytes.length);
    // Nunca cortar no meio de um caractere multibyte: recua até o começo dele.
    while (fim < bytes.length && (bytes[fim] & 0b1100_0000) === 0b1000_0000) fim -= 1;
    partes.push(bytes.subarray(inicio, fim).toString('utf8'));
    inicio = fim;
    limite = 74; // as seguintes gastam um octeto com o espaço da continuação
  }
  return partes.join('\r\n ');
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const naoEncontrado = new Response('Agendamento não encontrado', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });

  const verificado = verifyManageToken(token);
  if (!verificado) return naoEncontrado;

  const [linha] = await db
    .select({
      id: appointment.id,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      status: appointment.status,
      serviceName: appointment.serviceNameSnapshot,
      staffName: staff.name,
      shopName: barbershop.name,
      shopPhone: barbershop.phone,
    })
    .from(appointment)
    .innerJoin(staff, eq(staff.id, appointment.staffId))
    .innerJoin(barbershop, eq(barbershop.id, appointment.barbershopId))
    .where(eq(appointment.id, verificado.appointmentId))
    .limit(1);

  if (!linha) return naoEncontrado;

  const descricao = [
    `${linha.serviceName} com ${linha.staffName}`,
    linha.shopPhone ? `Telefone da barbearia: ${linha.shopPhone}` : null,
  ]
    .filter(Boolean)
    .join(' — ');

  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Barbearia//Agendamento//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // O id do agendamento é estável, então reimportar o mesmo convite atualiza
    // o evento no calendário em vez de criar um segundo.
    `UID:${linha.id}@barbearia`,
    `DTSTAMP:${instante(new Date())}`,
    `DTSTART:${instante(linha.startAt)}`,
    `DTEND:${instante(linha.endAt)}`,
    `SUMMARY:${escapar(`${linha.serviceName} com ${linha.staffName}`)}`,
    `LOCATION:${escapar(linha.shopName)}`,
    `DESCRIPTION:${escapar(descricao)}`,
    `STATUS:${linha.status === 'CANCELED' ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  // CRLF em toda linha, inclusive a última: leitor sério recusa o arquivo com
  // quebra de linha solta.
  const corpo = `${linhas.map(dobrar).join('\r\n')}\r\n`;

  return new Response(corpo, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="agendamento.ics"',
      'Cache-Control': 'no-store',
    },
  });
}
