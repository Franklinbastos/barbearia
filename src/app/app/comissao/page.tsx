import { DateTime } from 'luxon';
import Link from 'next/link';

import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { db } from '@/db/client';
import { findBarbershopById, listAllStaff, listAppointmentsBetween } from '@/db/repositories';
import {
  calcularComissao,
  detalharComissao,
  type ItemDeComissao,
} from '@/domain/indicadores/comissao';
import { resolverPeriodo, type Periodo } from '@/domain/indicadores/periodo';
import { formatDateTime } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { formatarReais } from '../resumo/tabela-por-barbeiro';

/**
 * O fechamento da comissão, atendimento a atendimento (§4 do spec).
 *
 * **Esta tela existe para encerrar uma discussão, não para informar um total.**
 * As quatro brigas típicas do fechamento são divergência de valor, atendimento
 * não registrado, cliente que faltou e o que compõe a base — e as quatro morrem
 * diante de uma lista com data, cliente, serviço, valor e comissão. "Sem
 * registro, não tem argumento", e o registro é o que temos.
 *
 * **O total do rodapé é a soma das linhas de cima, e isso não é detalhe de
 * implementação.** É a conferência que o barbeiro faz com o dedo na tela. Se o
 * total fosse calculado sobre a base e as linhas fossem arredondadas uma a uma,
 * os dois divergiriam em centavos — e a divergência de centavo destrói a
 * confiança na funcionalidade inteira. Quem garante isso é `comissao.ts`, com
 * um único ponto de arredondamento por atendimento.
 *
 * **Barbeiro sem percentual não aparece aqui.** Nulo não é zero: ele não
 * trabalha por comissão, e uma linha zerada no fechamento dele seria uma
 * afirmação errada. Quem manda configurar é o resumo, com link para a equipe.
 */

const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'mes', rotulo: 'Mês' },
];

/**
 * A querystring desta tela, trocando uma peça de cada vez.
 *
 * A URL é o estado inteiro — período e barbeiro —, então cada link precisa
 * carregar o que não está mudando. Sem isso, escolher outro barbeiro jogaria o
 * dono de volta para a semana corrente no meio do fechamento do mês.
 */
function comBusca(atual: {
  periodo: Periodo;
  de?: string;
  ate?: string;
  barbeiro?: string;
}): string {
  const busca = new URLSearchParams();
  busca.set('periodo', atual.periodo);
  if (atual.periodo === 'livre' && atual.de && atual.ate) {
    busca.set('de', atual.de);
    busca.set('ate', atual.ate);
  }
  if (atual.barbeiro) busca.set('barbeiro', atual.barbeiro);
  return `/app/comissao?${busca.toString()}`;
}

const LINK_DE_ESCOLHA =
  'inline-flex min-h-9 items-center rounded-lg border border-input px-3 text-sm leading-5 no-underline';
const LINK_ESCOLHIDO = 'border-transparent bg-primary text-primary-foreground';

export default async function ComissaoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string; barbeiro?: string }>;
}) {
  const { periodo, de, ate, barbeiro } = await searchParams;
  const sessao = await requireSession();

  const loja = await findBarbershopById(db, sessao.barbershopId);
  const timeZone = loja?.timeZone ?? 'America/Sao_Paulo';

  const relogio = DateTime.now().setZone(timeZone);
  const janela = resolverPeriodo({ periodo, de, ate, timeZone, agora: relogio });

  const [equipe, atendimentos] = await Promise.all([
    listAllStaff(db, sessao.barbershopId),
    // A consulta da agenda serve aqui inteira: é a única que já traz o nome do
    // serviço e o do cliente, que são justamente as duas colunas que fazem esta
    // tela valer alguma coisa numa conferência.
    listAppointmentsBetween(db, sessao.barbershopId, janela.inicio, janela.fim),
  ]);

  const itens: ItemDeComissao[] = atendimentos.map((a) => ({
    id: a.id,
    staffId: a.staffId,
    startAt: a.startAt,
    status: a.status,
    precoCents: a.servicePriceCents,
    servico: a.serviceName,
    cliente: a.customerName,
  }));

  const totais = calcularComissao(
    itens,
    equipe.map((membro) => ({
      id: membro.id,
      nome: membro.name,
      percentual: membro.commissionPercent,
    })),
  );

  // Sem `?barbeiro=` abre no primeiro da lista — que é o de maior comissão, e é
  // por ele que o fechamento começa. Id desconhecido cai no mesmo lugar em vez
  // de mostrar tela vazia.
  const escolhido = totais.find((t) => t.staffId === barbeiro) ?? totais[0];
  const linhas = escolhido
    ? detalharComissao(itens, escolhido.staffId, escolhido.percentual)
    : [];

  const base = { periodo: janela.periodo, de, ate };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/app/resumo" className="text-sm leading-5">
          ← Resumo
        </Link>
        <CabecalhoDePagina titulo="Comissão" descricao={janela.rotulo} />
      </div>

      <nav aria-label="Período" className="flex flex-wrap gap-2">
        {PERIODOS.map((opcao) => (
          <Link
            key={opcao.valor}
            href={comBusca({ ...base, periodo: opcao.valor, barbeiro: escolhido?.staffId })}
            aria-current={janela.periodo === opcao.valor ? 'page' : undefined}
            className={`${LINK_DE_ESCOLHA} ${janela.periodo === opcao.valor ? LINK_ESCOLHIDO : ''}`}
          >
            {opcao.rotulo}
          </Link>
        ))}
      </nav>

      {totais.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum barbeiro trabalha por comissão</CardTitle>
            <CardDescription>
              O fechamento aparece assim que alguém tiver um percentual configurado. Campo vazio no
              cadastro quer dizer &ldquo;sem comissão&rdquo;, e é por isso que ninguém aparece aqui.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/app/equipe">Configurar a comissão da equipe</Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <nav aria-label="Barbeiro" className="flex flex-wrap gap-2">
            {totais.map((total) => (
              <Link
                key={total.staffId}
                href={comBusca({ ...base, barbeiro: total.staffId })}
                aria-current={total.staffId === escolhido?.staffId ? 'page' : undefined}
                className={`${LINK_DE_ESCOLHA} ${
                  total.staffId === escolhido?.staffId ? LINK_ESCOLHIDO : ''
                }`}
              >
                {total.nome}
                <span className="ml-2 tabular-nums opacity-80">
                  {formatarReais(total.comissaoCents)}
                </span>
              </Link>
            ))}
          </nav>

          {escolhido ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {escolhido.nome} · {escolhido.percentual}% sobre o que atendeu
                </CardTitle>
                <CardDescription>
                  {escolhido.atendimentos === 0
                    ? 'Nenhum atendimento concluído neste período — não há comissão a pagar.'
                    : `${escolhido.atendimentos} ${
                        escolhido.atendimentos === 1 ? 'atendimento' : 'atendimentos'
                      } concluídos, base de ${formatarReais(escolhido.baseCents)}. Falta e cancelamento não entram.`}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {linhas.length === 0 ? (
                  <p className="text-sm leading-5 text-muted-foreground">
                    Sem atendimento concluído no período. Troque o período acima ou confira a
                    agenda: atendimento que não foi fechado como concluído não entra na comissão.
                  </p>
                ) : (
                  <>
                    {/* Desktop: a tabela, com o total no rodapé — é ali que a
                        conferência termina. */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Quando</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Serviço</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">Comissão</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {linhas.map((linha) => (
                            <TableRow key={linha.appointmentId}>
                              <TableCell className="tabular-nums">
                                {formatDateTime(linha.quando, timeZone)}
                              </TableCell>
                              <TableCell>{linha.cliente}</TableCell>
                              <TableCell>{linha.servico}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatarReais(linha.precoCents)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatarReais(linha.comissaoCents)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell colSpan={3}>Total</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatarReais(escolhido.baseCents)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatarReais(escolhido.comissaoCents)}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>

                    {/* Celular: uma linha por atendimento, empilhada. */}
                    <ul className="flex flex-col divide-y divide-border md:hidden">
                      {linhas.map((linha) => (
                        <li key={linha.appointmentId} className="flex flex-col gap-1 py-3 first:pt-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="min-w-0 truncate text-base leading-6 font-medium">
                              {linha.cliente}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {formatarReais(linha.comissaoCents)}
                            </span>
                          </div>
                          <p className="text-sm leading-5 text-muted-foreground">
                            {formatDateTime(linha.quando, timeZone)} · {linha.servico} ·{' '}
                            {formatarReais(linha.precoCents)}
                          </p>
                        </li>
                      ))}
                    </ul>

                    <p className="pt-3 text-base leading-6 md:hidden">
                      Total: <strong className="tabular-nums">{formatarReais(escolhido.comissaoCents)}</strong>{' '}
                      sobre {formatarReais(escolhido.baseCents)}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
