/**
 * Ponte entre o dia civil que o produto usa e o `Date` que o `Calendar` fala.
 *
 * O produto trabalha o tempo todo com `YYYY-MM-DD` **já no fuso da barbearia** —
 * o servidor produz essas strings com Luxon e elas atravessam URL, formulário e
 * banco sem nunca virar instante. O `Calendar` do shadcn, por outro lado, fala
 * `Date` do navegador.
 *
 * A regra é **não converter**. Nada aqui passa por UTC: nem `new Date('2026-08-13')`
 * (que o navegador lê como meia-noite UTC e devolve o dia anterior a oeste de
 * Greenwich), nem `toISOString().slice(0, 10)` (que faz o mesmo no caminho de
 * volta). O `Date` produzido é um portador do dia civil, não um instante — por
 * isso as duas funções são simétricas e só olham os getters locais.
 *
 * Mora em `lib` porque a agenda do painel e o encaixe precisam exatamente da
 * mesma conversão, e duas cópias dessa lógica divergiriam no primeiro ajuste.
 */

/** `YYYY-MM-DD` do fuso da loja → `Date` local do mesmo dia civil, ao meio-dia. */
export function isoParaData(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number);
  // Meio-dia, e não meia-noite: há fusos em que a meia-noite local não existe no
  // dia da virada de horário de verão, e o `Date` escorrega para o dia anterior.
  // É a mesma defesa do `T12:00:00Z` do `src/lib/format.ts`.
  return new Date(ano!, mes! - 1, dia!, 12);
}

/** `Date` local → `YYYY-MM-DD` pelo calendário local. Nunca por UTC. */
export function dataParaISO(data: Date): string {
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;
}
