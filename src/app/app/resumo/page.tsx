import { DateTime } from 'luxon';
import Link from 'next/link';

import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/db/client';
import {
  findBarbershopById,
  listAllStaff,
  listarAtendimentosDoPeriodo,
  listarExpedienteEBloqueios,
  listarHistoricoDeClientes,
} from '@/db/repositories';
import { calcularClientes, listarSumidos } from '@/domain/indicadores/cliente';
import { calcularComportamento } from '@/domain/indicadores/comportamento';
import { calcularDinheiro } from '@/domain/indicadores/dinheiro';
import { calcularOcupacao } from '@/domain/indicadores/ocupacao';
import { janelaAnterior, resolverPeriodo, type Janela } from '@/domain/indicadores/periodo';
import { formatDuration } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { CartaoIndicador, type ComparacaoDoIndicador } from './cartao-indicador';
import { ClientesSumidos } from './clientes-sumidos';
import { PeriodoSemAtendimento, SemHistorico, estadoDoResumo } from './estado-vazio';
import { GraficoDeOcupacao } from './grafico-de-ocupacao';
import { SeletorDePeriodo } from './seletor-de-periodo';
import {
  TabelaPorBarbeiro,
  montarLinhasPorBarbeiro,
  // O da tabela leva centavo: comissão é o número que o barbeiro confere, e
  // arredondar ali é justamente a divergência que a funcionalidade evita.
  formatarReais as formatarReaisExato,
} from './tabela-por-barbeiro';

/**
 * O resumo do dono (§5 do spec). A agenda é o que o balcão abre o dia inteiro;
 * esta é a tela onde o dono senta e pergunta como foi a semana.
 *
 * **Server Component, como as outras do painel.** Sessão, fuso da loja e
 * consultas acontecem aqui; de cliente só há o seletor de período e o gráfico —
 * e nenhum dos dois calcula nada, recebem número pronto.
 *
 * **A repartição é a mesma em toda a tela**: o repositório lê, o domínio
 * calcula, a página formata. Nenhuma conta de indicador mora neste arquivo; o
 * que existe aqui são as funções de formatação, que são borda por definição.
 *
 * **O fuso é o da barbearia.** `resolverPeriodo` recebe o relógio já em
 * `timeZone` e devolve a janela em instantes absolutos, que é o que o
 * repositório entende. Nenhuma data desta tela passa por UTC no caminho.
 *
 * **Em 360px tudo empilha e nada rola de lado**: a primeira dobra é uma coluna
 * até 640px, duas até 1280px e quatro acima disso; o gráfico mede o container;
 * a lista de sumidos empilha nome e botão.
 *
 * **Três saídas, não uma.** Antes de montar card nenhum a página pergunta a
 * `estadoDoResumo` em qual dos três casos do §5 do spec ela está: barbearia sem
 * histórico, período sem atendimento ou tela cheia. Os dois primeiros não são
 * variação visual — são telas diferentes, com texto e ação próprios, porque
 * `0,0%` em tudo mente igual nos dois e o dono não teria como saber qual dos
 * dois zeros está olhando. Ver `estado-vazio.tsx`.
 */

/** Um ano de histórico basta para medir o ritmo de quem corta a cada dois meses. */
const MESES_DE_HISTORICO = 12;

function formatarReais(cents: number): string {
  // Não é o `formatPrice` do catálogo: aquele devolve "Grátis" no zero, que é
  // certo para preço de serviço e absurdo para faturamento de uma semana parada.
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Fração de 0 a 1 → "68%". Inteiro: casa decimal em taxa de ocupação é ruído. */
function formatarPercentual(fracao: number): string {
  return `${Math.round(fracao * 100)}%`;
}

function plural(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

/** Como a comparação chama o período anterior, na voz de quem fala com o dono. */
function rotuloDoAnterior(janela: Janela): string {
  if (janela.periodo === 'hoje') return 'que ontem';
  if (janela.periodo === 'semana') return 'que a semana passada';
  if (janela.periodo === 'mes') return 'que o mês passado';
  return 'que o período anterior';
}

/**
 * A comparação com o período anterior, ou nada.
 *
 * **Sem base não há comparação.** Dividir por um período anterior zerado daria
 * "+∞%" ou um "+100%" inventado — a primeira semana de uma barbearia nova
 * apareceria como crescimento espetacular. Nesses casos o card simplesmente
 * não mostra o selo.
 */
function compararComAnterior(
  atualCents: number,
  anteriorCents: number,
  janela: Janela,
): ComparacaoDoIndicador | undefined {
  if (anteriorCents <= 0) return undefined;

  const variacao = Math.round(((atualCents - anteriorCents) / anteriorCents) * 100);
  const sinal = variacao > 0 ? '+' : '';

  return {
    valor: `${sinal}${variacao}% ${rotuloDoAnterior(janela)}`,
    melhorou: atualCents >= anteriorCents,
  };
}

export default async function ResumoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string }>;
}) {
  const { periodo, de, ate } = await searchParams;
  const sessao = await requireSession();

  const loja = await findBarbershopById(db, sessao.barbershopId);
  const timeZone = loja?.timeZone ?? 'America/Sao_Paulo';
  const nomeDaLoja = loja?.name ?? 'barbearia';

  const relogio = DateTime.now().setZone(timeZone);
  const agora = relogio.toJSDate();
  const janela = resolverPeriodo({ periodo, de, ate, timeZone, agora: relogio });
  const anterior = janelaAnterior(janela, timeZone);

  // O histórico da tabela por barbeiro é ancorado na **janela**, não no relógio:
  // para saber se quem estreou em março voltou, é preciso enxergar abril e maio
  // — que ficam depois do fim da janela. E o começo vai um ano atrás do início
  // dela, porque "novo" só é novo se ele não tinha vindo antes.
  const inicioDoHistorico = DateTime.fromJSDate(janela.inicio)
    .setZone(timeZone)
    .minus({ months: MESES_DE_HISTORICO })
    .startOf('day')
    .toJSDate();
  const fimDoHistorico = new Date(Math.max(janela.fim.getTime(), agora.getTime()));

  const [itens, itensDoAnterior, expedienteEBloqueios, historico, historicoBruto, equipe] =
    await Promise.all([
      listarAtendimentosDoPeriodo(db, sessao.barbershopId, janela.inicio, janela.fim),
      listarAtendimentosDoPeriodo(db, sessao.barbershopId, anterior.inicio, anterior.fim),
      listarExpedienteEBloqueios(db, sessao.barbershopId, janela.inicio, janela.fim),
      listarHistoricoDeClientes(
        db,
        sessao.barbershopId,
        relogio.minus({ months: MESES_DE_HISTORICO }).startOf('day').toJSDate(),
      ),
      listarAtendimentosDoPeriodo(db, sessao.barbershopId, inicioDoHistorico, fimDoHistorico),
      listAllStaff(db, sessao.barbershopId),
    ]);

  // Os clientes sumidos não dependem da janela — o corte é o ritmo de cada um
  // contra o relógio —, então a lista aparece nos dois estados em que a tela
  // ainda tem o que dizer. Numa semana parada ela é justamente o que o dono
  // pode fazer a respeito.
  const sumidos = listarSumidos(historico, agora);

  const cabecalho = <CabecalhoDePagina titulo="Resumo" descricao={janela.rotulo} />;

  const cardDeSumidos = (
    <Card>
      <CardHeader>
        <CardTitle>Clientes sumidos</CardTitle>
        <CardDescription>
          Quem passou de uma vez e meia o próprio intervalo entre cortes, do mais atrasado para o
          menos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ClientesSumidos clientes={sumidos} nomeDaLoja={nomeDaLoja} timeZone={timeZone} />
      </CardContent>
    </Card>
  );

  const estado = estadoDoResumo({
    itensDaJanela: itens.length,
    itensDoHistorico: historicoBruto.length,
    clientesComVisita: historico.length,
  });

  // Barbearia sem nada para medir: nem o seletor de período entra. Escolher
  // entre semana e mês quando os três estão vazios é oferecer uma decisão que
  // não muda nada — e um `0%` de ocupação numa loja que nunca abriu a agenda
  // leria como cadeira parada, que é uma acusação falsa.
  if (estado === 'sem-historico') {
    return (
      <div className="flex flex-col gap-6">
        {cabecalho}
        <SemHistorico />
      </div>
    );
  }

  const seletor = (
    <SeletorDePeriodo
      periodo={janela.periodo}
      rotulo={janela.rotulo}
      de={de}
      ate={ate}
      hojeISO={relogio.toISODate()!}
    />
  );

  // Janela vazia numa loja que tem movimento: o seletor fica (é por ele que se
  // sai daqui), os cards saem, e o atalho leva ao período anterior — que é onde
  // o número existe.
  if (estado === 'periodo-vazio') {
    return (
      <div className="flex flex-col gap-6">
        {cabecalho}
        {seletor}
        <PeriodoSemAtendimento janela={janela} anterior={anterior} timeZone={timeZone} />
        {cardDeSumidos}
      </div>
    );
  }

  const dinheiro = calcularDinheiro(itens, agora);
  const dinheiroAnterior = calcularDinheiro(itensDoAnterior, agora);
  const comportamento = calcularComportamento(itens);
  const ocupacao = calcularOcupacao({
    itens,
    expediente: expedienteEBloqueios.expediente,
    bloqueios: expedienteEBloqueios.bloqueios,
    janela,
    timeZone,
    agora,
  });
  const clientes = calcularClientes(historico, janela, agora);

  const minutosVagos = Math.max(0, Math.round(ocupacao.minutosDisponiveis - ocupacao.minutosOcupados));

  const linhasPorBarbeiro = montarLinhasPorBarbeiro({
    barbeiros: equipe.map((membro) => ({
      id: membro.id,
      nome: membro.name,
      ativo: membro.active,
      percentual: membro.commissionPercent,
    })),
    itens,
    historico: historicoBruto,
    ocupacao: ocupacao.porBarbeiro,
    janela,
    agora,
  });

  // `null` = ninguém tem percentual configurado, que é diferente de a comissão
  // do período ter dado zero. Um manda configurar, o outro é um número.
  const comissionados = linhasPorBarbeiro.filter((linha) => linha.comissaoCents !== null);
  const totalDeComissaoCents =
    comissionados.length === 0
      ? null
      : comissionados.reduce((soma, linha) => soma + (linha.comissaoCents ?? 0), 0);

  // O detalhe da comissão abre na mesma janela em que a tabela foi lida.
  const buscaDoPeriodo =
    janela.periodo === 'livre' && de && ate
      ? `&periodo=livre&de=${de}&ate=${ate}`
      : `&periodo=${janela.periodo}`;

  return (
    <div className="flex flex-col gap-6">
      {cabecalho}

      {seletor}

      {/* A primeira dobra do spec: dinheiro, tempo, ticket e falta, nesta ordem.
          Uma coluna no celular, duas no tablet, quatro no desktop. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoIndicador
          titulo="Faturamento"
          valor={formatarReais(dinheiro.faturamentoCents)}
          apoio={
            dinheiro.previstoCents > 0
              ? `${formatarReais(dinheiro.previstoCents)} previstos no que falta`
              : plural(dinheiro.atendimentos, 'atendimento concluído', 'atendimentos concluídos')
          }
          comparacao={compararComAnterior(
            dinheiro.faturamentoCents,
            dinheiroAnterior.faturamentoCents,
            janela,
          )}
          explicacao="Soma do preço dos atendimentos concluídos no período, com o preço congelado no momento do agendamento. Agendado do futuro não entra no faturamento — aparece como previsto."
        />

        <CartaoIndicador
          titulo="Ocupação"
          valor={formatarPercentual(ocupacao.taxa)}
          apoio={
            ocupacao.minutosDisponiveis > 0
              ? `${formatDuration(minutosVagos)} de cadeira vaga`
              : 'Sem expediente cadastrado no período'
          }
          explicacao="Minutos ocupados ÷ minutos disponíveis. Disponível é o expediente do dia, menos bloqueios e menos o que ainda não chegou. Falta ocupa, porque a cadeira ficou reservada; cancelamento não, porque o horário voltou para a grade."
        />

        <CartaoIndicador
          titulo="Ticket médio"
          valor={formatarReais(dinheiro.ticketMedioCents)}
          apoio={`em ${plural(dinheiro.atendimentos, 'atendimento', 'atendimentos')}`}
          explicacao="Faturamento ÷ número de atendimentos concluídos. Falta e cancelamento ficam de fora do divisor: eles têm taxa própria e derrubariam o ticket sem que nenhum preço tivesse mudado."
        />

        <CartaoIndicador
          titulo="Taxa de falta"
          valor={formatarPercentual(comportamento.taxaFalta)}
          apoio={
            dinheiro.perdidoCents > 0
              ? `${formatarReais(dinheiro.perdidoCents)} perdidos com quem não veio`
              : 'Ninguém faltou no período'
          }
          explicacao="Faltas ÷ (atendidos + faltas). Cancelamento não entra no divisor: quem cancela devolve o horário para a grade, quem falta deixa a cadeira parada."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ocupação por hora</CardTitle>
          <CardDescription>
            Onde a barra afunda é onde há hora para vender — {janela.rotulo}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ocupacao.porHora.length > 0 ? (
            <GraficoDeOcupacao dados={ocupacao.porHora} />
          ) : (
            <p className="text-sm leading-5 text-muted-foreground">
              O gráfico aparece quando houver expediente cadastrado no período. Sem horário de
              trabalho não há denominador, e uma barra zerada leria como cadeira vazia em vez de
              loja fechada.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Por barbeiro</CardTitle>
          <CardDescription>
            Quem produziu o quê em {janela.rotulo}. A taxa de retorno é a coluna que separa quem tem
            clientela própria de quem pega o que cai.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <TabelaPorBarbeiro linhas={linhasPorBarbeiro} buscaDoPeriodo={buscaDoPeriodo} />

          {totalDeComissaoCents === null ? (
            <p className="text-sm leading-5 text-muted-foreground">
              Nenhum barbeiro tem percentual de comissão configurado.{' '}
              <Link href="/app/equipe">Configure na equipe</Link> para ver o fechamento.
            </p>
          ) : (
            <p className="text-sm leading-5 text-muted-foreground">
              Comissão do período:{' '}
              <strong className="tabular-nums">{formatarReaisExato(totalDeComissaoCents)}</strong>{' '}
              · <Link href={`/app/comissao?${buscaDoPeriodo.slice(1)}`}>ver atendimento a atendimento</Link>
            </p>
          )}
        </CardContent>
      </Card>

      {cardDeSumidos}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <CartaoIndicador
          titulo="Clientes atendidos"
          valor={String(clientes.atendidos)}
          apoio={`${plural(clientes.novos, 'novo', 'novos')} · ${plural(clientes.recorrentes, 'recorrente', 'recorrentes')}`}
          explicacao="Clientes distintos com atendimento concluído no período. Novo é quem teve a primeira visita da vida dentro dele; o restante já tinha vindo antes."
        />

        <CartaoIndicador
          titulo="Entre visitas"
          valor={
            clientes.diasEntreVisitas === null
              ? '—'
              : plural(clientes.diasEntreVisitas, 'dia', 'dias')
          }
          apoio="média do tempo que cada um passou fora antes de voltar"
          explicacao="Média dos intervalos que se fecharam no período: para cada visita, quanto tempo o cliente passou sem aparecer antes dela. Quem veio uma vez só não entra na conta."
        />

        <CartaoIndicador
          titulo="Taxa de retorno"
          valor={clientes.novos === 0 ? '—' : formatarPercentual(clientes.taxaRetorno)}
          apoio={
            clientes.novos === 0
              ? 'ninguém estreou neste período'
              : 'de quem estreou e já teve 90 dias para voltar'
          }
          explicacao="Dos clientes que estrearam no período, a fração que voltou em até 90 dias. Só entra na conta quem já teve esses 90 dias inteiros para voltar — antes disso a coorte ainda não amadureceu e o número mentiria para cima."
        />
      </div>
    </div>
  );
}
