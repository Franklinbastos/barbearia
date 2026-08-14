import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  JANELA_DE_RETORNO,
  calcularClientes,
  type VisitaDoCliente,
} from '@/domain/indicadores/cliente';
import { calcularComissao } from '@/domain/indicadores/comissao';
import { calcularComportamento } from '@/domain/indicadores/comportamento';
import { calcularDinheiro, type AtendimentoBruto } from '@/domain/indicadores/dinheiro';
import type { OcupacaoDoBarbeiro } from '@/domain/indicadores/ocupacao';
import type { Janela } from '@/domain/indicadores/periodo';

/**
 * A tabela por barbeiro (§3.5 do spec): uma linha por profissional, com o que
 * ele produziu no período.
 *
 * **A coluna que ninguém tem é a taxa de retorno.** Faturamento e ocupação por
 * barbeiro qualquer sistema mostra; retenção por barbeiro é o que separa
 * "tem clientela própria" de "pega o que cai" — 8 de 19 produtos pesquisados
 * têm, e nenhum brasileiro com esse recorte. Ela reusa `calcularClientes`, com
 * o histórico filtrado pelo `staffId`: "novo" passa a ser quem estreou **com
 * aquele barbeiro**, e "voltou" é quem voltou **para ele**.
 *
 * **No celular a tabela vira lista de cards**, o mesmo tratamento que a agenda
 * recebeu: nove colunas em 360px só existem como rolagem lateral, e número que
 * o dono precisa rolar para ver é número que ele não olha.
 *
 * **Traço não é zero.** Ocupação sem expediente cadastrado, falta sem nenhum
 * atendimento fechado e retorno de coorte que ainda não amadureceu aparecem
 * como `—`. Mostrar `0%` nos três casos seria afirmar coisas que não
 * aconteceram — que a cadeira ficou vazia, que ninguém faltou de um universo
 * inexistente, que nenhum estreante voltou quando nenhum teve tempo de voltar.
 */

/** Dinheiro com centavo: é o número que o barbeiro confere, não o que o dono estima. */
export function formatarReais(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

/** Fração de 0 a 1 → "68%". Casa decimal em taxa é ruído. */
export function formatarPercentual(fracao: number): string {
  return `${Math.round(fracao * 100)}%`;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export type BarbeiroDaTabela = {
  id: string;
  nome: string;
  ativo: boolean;
  /** `staff.commissionPercent`. `null` = não trabalha por comissão. */
  percentual: number | null;
};

export type LinhaDoBarbeiro = {
  staffId: string;
  nome: string;
  ativo: boolean;
  atendimentos: number;
  faturamentoCents: number;
  ticketMedioCents: number;
  /** `null` quando o barbeiro não tem expediente cadastrado no período. */
  ocupacao: number | null;
  /** `null` quando não houve atendido nem falta — não há do que tirar taxa. */
  taxaFalta: number | null;
  /** Clientes que estrearam **com este barbeiro** no período. */
  novos: number;
  /** `null` enquanto nenhuma estreia do período completou 90 dias. */
  taxaRetorno: number | null;
  /** `null` = sem percentual configurado. A tela oferece configurar, não zero. */
  comissaoCents: number | null;
  percentual: number | null;
};

export type MontarLinhasArgs = {
  barbeiros: BarbeiroDaTabela[];
  /** Os atendimentos da janela. */
  itens: AtendimentoBruto[];
  /**
   * Um ano de atendimentos concluídos até o fim da janela — a matéria-prima do
   * retorno por barbeiro. Precisa ir muito além da janela: "novo" só é novo se
   * ele não veio antes, e "voltou" só se sabe olhando 90 dias para a frente.
   */
  historico: AtendimentoBruto[];
  ocupacao: Map<string, OcupacaoDoBarbeiro>;
  janela: Janela;
  agora: Date;
};

/**
 * O histórico de visitas de cada cliente **daquele barbeiro**.
 *
 * `calcularClientes` só olha as datas, então nome e telefone vão vazios de
 * propósito: aqui a pergunta é sobre ritmo e retorno, e carregar identificação
 * de cliente para um número agregado seria dado a mais circulando por nada.
 */
function visitasDoBarbeiro(historico: AtendimentoBruto[], staffId: string): VisitaDoCliente[] {
  const porCliente = new Map<string, Date[]>();

  for (const item of historico) {
    if (item.staffId !== staffId || item.status !== 'DONE') continue;
    porCliente.set(item.customerId, [...(porCliente.get(item.customerId) ?? []), item.startAt]);
  }

  return [...porCliente].map(([customerId, visitas]) => ({
    customerId,
    nome: '',
    telefone: '',
    visitas,
  }));
}

/**
 * Se alguma estreia do período já teve os 90 dias inteiros para voltar.
 *
 * Sem isto, a semana corrente mostraria "0% de retorno" para todo mundo —
 * ninguém teve tempo de voltar ainda —, e um zero desses lido como desempenho
 * do barbeiro é injusto e falso ao mesmo tempo. É a mesma maturidade de coorte
 * que `calcularClientes` usa por dentro para montar o denominador.
 */
function houveCoorteMadura(visitas: VisitaDoCliente[], janela: Janela, agora: Date): boolean {
  return visitas.some((cliente) => {
    const primeira = cliente.visitas.reduce((a, b) => (a < b ? a : b));
    if (primeira < janela.inicio || primeira >= janela.fim) return false;
    return (agora.getTime() - primeira.getTime()) / MS_POR_DIA >= JANELA_DE_RETORNO;
  });
}

/**
 * Monta as linhas da tabela a partir do que a página já leu.
 *
 * Nada de conta nova: cada número sai da função de domínio que já o define
 * (`calcularDinheiro`, `calcularComportamento`, `calcularComissao`,
 * `calcularClientes`), aplicada à fatia daquele barbeiro. É o que garante que a
 * linha do João somada às outras dê o mesmo total dos cards da primeira dobra —
 * se a tabela tivesse fórmula própria, um dia divergiria da tela acima dela.
 *
 * **Barbeiro desativado só aparece se produziu no período.** Quem saiu em
 * março não polui o fechamento de agosto, mas o fechamento de março continua
 * mostrando o que ele fez — e a comissão que ele tem a receber.
 */
export function montarLinhasPorBarbeiro(args: MontarLinhasArgs): LinhaDoBarbeiro[] {
  const { barbeiros, itens, historico, ocupacao, janela, agora } = args;

  const comissaoPorStaff = new Map(
    calcularComissao(
      itens,
      barbeiros.map((b) => ({ id: b.id, nome: b.nome, percentual: b.percentual })),
    ).map((c) => [c.staffId, c]),
  );

  return barbeiros
    .map((barbeiro) => {
      const doBarbeiro = itens.filter((item) => item.staffId === barbeiro.id);
      const dinheiro = calcularDinheiro(doBarbeiro, agora);
      const comportamento = calcularComportamento(doBarbeiro);
      const ocupacaoDele = ocupacao.get(barbeiro.id);
      const visitas = visitasDoBarbeiro(historico, barbeiro.id);
      const clientes = calcularClientes(visitas, janela, agora);

      const fechados = doBarbeiro.filter(
        (item) => item.status === 'DONE' || item.status === 'NO_SHOW',
      ).length;

      return {
        staffId: barbeiro.id,
        nome: barbeiro.nome,
        ativo: barbeiro.ativo,
        atendimentos: dinheiro.atendimentos,
        faturamentoCents: dinheiro.faturamentoCents,
        ticketMedioCents: dinheiro.ticketMedioCents,
        ocupacao:
          ocupacaoDele && ocupacaoDele.disponiveis > 0 ? ocupacaoDele.taxa : null,
        taxaFalta: fechados > 0 ? comportamento.taxaFalta : null,
        novos: clientes.novos,
        taxaRetorno: houveCoorteMadura(visitas, janela, agora) ? clientes.taxaRetorno : null,
        comissaoCents: comissaoPorStaff.get(barbeiro.id)?.comissaoCents ?? null,
        percentual: barbeiro.percentual,
      };
    })
    .filter((linha) => linha.ativo || linha.atendimentos > 0)
    .sort((a, b) => b.faturamentoCents - a.faturamentoCents || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** `null` vira traço; é a diferença entre "não houve" e "foi zero". */
function ouTraco(valor: number | null, formatar: (n: number) => string): string {
  return valor === null ? '—' : formatar(valor);
}

export type TabelaPorBarbeiroProps = {
  linhas: LinhaDoBarbeiro[];
  /** A querystring do período, para o link do detalhe abrir a mesma janela. */
  buscaDoPeriodo: string;
};

/** A célula de comissão: valor com link para o detalhe, ou convite para configurar. */
function CelulaDeComissao({
  linha,
  buscaDoPeriodo,
}: {
  linha: LinhaDoBarbeiro;
  buscaDoPeriodo: string;
}) {
  // O terceiro estado vazio do §5 do spec: sem percentual configurado a célula
  // é um caminho, nunca `R$ 0,00`. Zero ali afirmaria que o barbeiro não tem
  // nada a receber, quando o que houve foi um campo em branco no cadastro.
  if (linha.comissaoCents === null) {
    return (
      <Link
        href={`/app/equipe/${linha.staffId}`}
        className="text-sm leading-5 text-muted-foreground"
      >
        configurar
        <span className="sr-only"> a comissão de {linha.nome}</span>
      </Link>
    );
  }

  return (
    <Link
      href={`/app/comissao?barbeiro=${linha.staffId}${buscaDoPeriodo}`}
      className="tabular-nums"
    >
      {formatarReais(linha.comissaoCents)}
    </Link>
  );
}

export function TabelaPorBarbeiro({ linhas, buscaDoPeriodo }: TabelaPorBarbeiroProps) {
  if (linhas.length === 0) {
    return (
      <p data-slot="tabela-por-barbeiro-vazia" className="text-sm leading-5 text-muted-foreground">
        Nenhum barbeiro ativo na equipe. Cadastre a equipe para ver quanto cada um produziu.
      </p>
    );
  }

  return (
    <div data-slot="tabela-por-barbeiro">
      {/* Desktop: a tabela inteira, com rolagem própria se faltar largura. */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Barbeiro</TableHead>
              <TableHead className="text-right">Atend.</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
              <TableHead className="text-right">Ticket</TableHead>
              <TableHead className="text-right">Ocupação</TableHead>
              <TableHead className="text-right">Falta</TableHead>
              <TableHead className="text-right">Novos</TableHead>
              <TableHead className="text-right">Retorno</TableHead>
              <TableHead className="text-right">Comissão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((linha) => (
              <TableRow key={linha.staffId}>
                <TableCell className="font-medium">
                  {linha.nome}
                  {linha.ativo ? null : (
                    <span className="text-muted-foreground"> · inativo</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{linha.atendimentos}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatarReais(linha.faturamentoCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatarReais(linha.ticketMedioCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {ouTraco(linha.ocupacao, formatarPercentual)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {ouTraco(linha.taxaFalta, formatarPercentual)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{linha.novos}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {ouTraco(linha.taxaRetorno, formatarPercentual)}
                </TableCell>
                <TableCell className="text-right">
                  <CelulaDeComissao linha={linha} buscaDoPeriodo={buscaDoPeriodo} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Celular: um card por barbeiro, com os pares rótulo/valor em grade de
          duas colunas. Nada rola de lado. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {linhas.map((linha) => (
          <li key={linha.staffId}>
            <Card>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-2">
                  <strong className="text-[17px] leading-[22px] font-bold">{linha.nome}</strong>
                  <span className="text-sm leading-5 tabular-nums text-muted-foreground">
                    {linha.atendimentos} atend.
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm leading-5">
                  <div>
                    <dt className="text-muted-foreground">Faturamento</dt>
                    <dd className="tabular-nums">{formatarReais(linha.faturamentoCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Ticket</dt>
                    <dd className="tabular-nums">{formatarReais(linha.ticketMedioCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Ocupação</dt>
                    <dd className="tabular-nums">{ouTraco(linha.ocupacao, formatarPercentual)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Falta</dt>
                    <dd className="tabular-nums">{ouTraco(linha.taxaFalta, formatarPercentual)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Novos</dt>
                    <dd className="tabular-nums">{linha.novos}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Retorno</dt>
                    <dd className="tabular-nums">
                      {ouTraco(linha.taxaRetorno, formatarPercentual)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Comissão</dt>
                    <dd>
                      <CelulaDeComissao linha={linha} buscaDoPeriodo={buscaDoPeriodo} />
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
