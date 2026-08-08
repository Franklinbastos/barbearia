import { NextResponse } from 'next/server';
import { and, asc, eq, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { customer } from '@/db/schema';
import { findBarbershopById } from '@/db/repositories';
import { requireSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Busca de cliente do balcão (§5.10).
 *
 * O furo que as três direções de design deixaram passar: toca o telefone,
 * "aqui é o Marcos, que horas eu marquei?", e sem isto só dá para varrer a
 * agenda um dia por vez com o cliente esperando na linha.
 *
 * `barbershopId` vem **da sessão**, nunca de parâmetro: é a regra de tenant do
 * projeto, e uma rota de busca com id na URL é o jeito mais barato de vazar a
 * lista de clientes de outra loja.
 */

/** Abaixo disto a busca não sai: uma letra devolveria a base quase inteira. */
const MINIMO_DE_CARACTERES = 2;

/** Teto de linhas. A folha mostra resultado, não relatório. */
const MAXIMO_DE_RESULTADOS = 20;

/**
 * Acentos fora dos dois lados da comparação, sem depender da extensão
 * `unaccent` (que exige superusuário para instalar e não existe em todo Neon).
 * `translate` é char a char e resolve o caso que interessa: "antonio" achando
 * "Antônio".
 */
const DE = 'áàâãäéèêëíìîïóòôõöúùûüýÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÝçÇñÑ';
const PARA = 'aaaaaeeeeiiiiooooouuuuyaaaaaeeeeiiiiooooouuuuyccnn';

/** Decompõe e joga fora os sinais diacríticos (U+0300–U+036F). */
function semAcento(valor: string): string {
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** `%`, `_` e `\` são curingas de LIKE: sem escapar, "%%" devolveria a base. */
function escaparLike(valor: string): string {
  return valor.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function GET(req: Request) {
  const sessao = await requireSession();

  const termo = (new URL(req.url).searchParams.get('q') ?? '').trim();
  const digitos = termo.replace(/\D/g, '');

  const loja = await findBarbershopById(db, sessao.barbershopId);
  const timeZone = loja?.timeZone ?? 'America/Sao_Paulo';

  if (termo.length < MINIMO_DE_CARACTERES) {
    return NextResponse.json({ clientes: [], timeZone }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const alvoDoNome = `%${escaparLike(semAcento(termo).toLowerCase())}%`;
  const nomeNormalizado = sql`translate(lower(${customer.name}), ${DE}, ${PARA})`;
  const telefoneSoDigitos = sql`regexp_replace(${customer.phone}, '[^0-9]', '', 'g')`;

  const porNome = sql`${nomeNormalizado} like ${alvoDoNome}`;
  // Só busca por telefone quando o balcão digitou dígitos — senão "an" viraria
  // uma varredura de telefone com padrão vazio.
  const porTelefone =
    digitos.length >= MINIMO_DE_CARACTERES
      ? sql`${telefoneSoDigitos} like ${`%${digitos}%`}`
      : undefined;

  /**
   * O próximo horário de cada cliente na mesma consulta. É o dado que responde
   * a pergunta do telefonema; buscá-lo depois, um por linha, seria N+1 no
   * caminho mais quente do balcão.
   *
   * A correlação com o cliente vai escrita à mão, e não por `${customer.id}`:
   * a interpolação de coluna sai **sem** o prefixo da tabela, e dentro do
   * subselect `"id"` passa a resolver para `a.id` — a comparação nunca casa e
   * todo mundo volta "sem horário marcado".
   */
  const proximo = sql<Date | string | null>`(
    select min(a.start_at) from appointment a
    where a.customer_id = "customer"."id"
      and a.barbershop_id = ${sessao.barbershopId}::uuid
      and a.status = 'BOOKED'
      and a.start_at >= now()
  )`;

  const linhas = await db
    .select({ id: customer.id, name: customer.name, phone: customer.phone, proximo })
    .from(customer)
    .where(and(eq(customer.barbershopId, sessao.barbershopId), or(porNome, porTelefone)))
    .orderBy(asc(customer.name))
    .limit(MAXIMO_DE_RESULTADOS);

  return NextResponse.json(
    {
      clientes: linhas.map((linha) => ({
        id: linha.id,
        name: linha.name,
        phone: linha.phone,
        proximo: linha.proximo ? new Date(linha.proximo).toISOString() : null,
      })),
      timeZone,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
