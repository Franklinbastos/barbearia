import { DateTime } from 'luxon';
import Link from 'next/link';

import { CabecalhoDePagina } from '@/components/ui/cabecalho-de-pagina';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/db/client';
import {
  findBarbershopById,
  listAllStaff,
  listarAtendimentosIniciadosNoPeriodo,
  listarAtendimentosQueOcupamOPeriodo,
  listarExpedienteEBloqueios,
  listarHistoricoDeClientes,
} from '@/db/repositories';
import { calcularClientes, listarSumidos, JANELA_DE_RETORNO } from '@/domain/indicadores/cliente';
import { calcularComportamento } from '@/domain/indicadores/comportamento';
import { calcularDinheiro } from '@/domain/indicadores/dinheiro';
import { calcularOcupacao } from '@/domain/indicadores/ocupacao';
import { janelaAnterior, recorteEquivalente, resolverPeriodo } from '@/domain/indicadores/periodo';
// O `formatMoney` leva centavo e o `formatMoneyRounded` não: o card é para
// decidir e a comissão é para conferir. Os dois moram em `lib/format` desde que
// duas cópias divergentes de "formatar reais" apareceram nesta tela.
import { formatDuration, formatMoney, formatMoneyRounded, formatPercent } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { CartaoIndicador } from './cartao-indicador';
import { ClientesSumidos } from './clientes-sumidos';
import { compararComAnterior } from './comparacao';
import { ComportamentoEOrigem } from './comportamento-e-origem';
import { PeriodoSemAtendimento, SemHistorico, estadoDoResumo } from './estado-vazio';
import { GraficoDeOcupacao } from './grafico-de-ocupacao';
import { apoioDoRetorno } from './retorno';
import { SeletorDePeriodo } from './seletor-de-periodo';
import { TabelaPorBarbeiro, montarLinhasPorBarbeiro } from './tabela-por-barbeiro';

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
 * que existe aqui é a escolha de qual consulta alimenta qual conta, e a
 * formatação, que é borda por definição.
 *
 * **Duas listas de atendimento, e a diferença não é acidente.** Dinheiro,
 * comportamento e cliente leem o que **começou** dentro da janela; a ocupação
 * lê o que **toca** a janela, porque ela conta minuto de cadeira e recorta a
 * parte de dentro. Juntar as duas põe o corte das 23:40 de domingo no
 * faturamento da segunda. O porquê está em `indicadores.repo.ts`.
 *
 * **Traço não é zero, e a página respeita isso como a tabela.** Onde o domínio
 * devolve `null` — ocupação sem expediente, falta sem atendido nem falta,
 * retorno de coorte que não amadureceu — o card mostra `—`. Ver `ouTraco`.
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

function plural(quantidade: number, singular: string, plural: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}

/**
 * Traço, nunca zero — a §5.12 da direção de UI, e a mesma função que a tabela
 * por barbeiro usa nas colunas dela.
 *
 * O domínio devolve `null` onde não há denominador (sem expediente cadastrado,
 * sem atendido nem falta, coorte que não amadureceu), e o trabalho da tela é só
 * não transformar isso em `0%`. Zero afirma que a cadeira ficou vazia, que
 * ninguém faltou, que nenhum estreante voltou — três coisas que não
 * aconteceram.
 */
function ouTraco(fracao: number | null): string {
  return fracao === null ? '—' : formatPercent(fracao);
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

  // **Todo histórico desta tela é ancorado na janela, não no relógio.** Para
  // saber se quem estreou em março voltou, é preciso enxergar abril e maio — que
  // ficam depois do fim da janela. E o começo vai um ano atrás do início dela,
  // porque "novo" só é novo se ele não tinha vindo antes. Ancorar um dos dois
  // históricos no relógio fazia a tabela por barbeiro e os cards de cliente
  // discordarem na mesma tela sempre que o dono abria um intervalo antigo.
  const inicioDoHistorico = DateTime.fromJSDate(janela.inicio)
    .setZone(timeZone)
    .minus({ months: MESES_DE_HISTORICO })
    .startOf('day')
    .toJSDate();
  const fimDoHistorico = new Date(Math.max(janela.fim.getTime(), agora.getTime()));

  // Comparação de percurso com percurso: numa janela em curso, o período
  // anterior é lido só até o mesmo ponto de avanço. Ver `comparacao.ts` para o
  // que estava errado e por que a saída não foi esconder o selo.
  const corteDoAnterior = recorteEquivalente(janela, anterior, agora);

  const [
    itens,
    itensParaOcupacao,
    itensDoAnterior,
    expedienteEBloqueios,
    historico,
    historicoBruto,
    equipe,
  ] = await Promise.all([
    // Dinheiro, comportamento e cliente: só o que **começou** dentro da janela.
    listarAtendimentosIniciadosNoPeriodo(db, sessao.barbershopId, janela.inicio, janela.fim),
    // Ocupação: tudo que **toca** a janela, porque ela mede minuto de cadeira e
    // corta a parte de dentro. As duas consultas existem por isso — ver
    // `indicadores.repo.ts`.
    listarAtendimentosQueOcupamOPeriodo(db, sessao.barbershopId, janela.inicio, janela.fim),
    listarAtendimentosIniciadosNoPeriodo(db, sessao.barbershopId, anterior.inicio, corteDoAnterior),
    listarExpedienteEBloqueios(db, sessao.barbershopId, janela.inicio, janela.fim),
    listarHistoricoDeClientes(db, sessao.barbershopId, inicioDoHistorico),
    listarAtendimentosIniciadosNoPeriodo(
      db,
      sessao.barbershopId,
      inicioDoHistorico,
      fimDoHistorico,
    ),
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
    itens: itensParaOcupacao,
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
          valor={formatMoneyRounded(dinheiro.faturamentoCents)}
          apoio={
            dinheiro.previstoCents > 0
              ? `${formatMoneyRounded(dinheiro.previstoCents)} previstos no que falta`
              : plural(dinheiro.atendimentos, 'atendimento concluído', 'atendimentos concluídos')
          }
          comparacao={compararComAnterior({
            atualCents: dinheiro.faturamentoCents,
            anteriorCents: dinheiroAnterior.faturamentoCents,
            janela,
            agora,
          })}
          explicacao="Soma do preço dos atendimentos concluídos no período, com o preço congelado no momento do agendamento. Agendado do futuro não entra no faturamento — aparece como previsto. A comparação com o período anterior lê o mesmo tanto de percurso dos dois lados: numa semana pela metade, meia semana contra meia semana."
        />

        <CartaoIndicador
          titulo="Ocupação"
          valor={ouTraco(ocupacao.taxa)}
          apoio={
            ocupacao.minutosDisponiveis > 0
              ? `${formatDuration(minutosVagos)} de cadeira vaga`
              : 'Sem expediente cadastrado no período'
          }
          explicacao="Minutos ocupados ÷ minutos disponíveis. Disponível é o expediente do dia, menos bloqueios e menos o que ainda não chegou. Falta ocupa, porque a cadeira ficou reservada; cancelamento não, porque o horário voltou para a grade. Sem expediente cadastrado não há denominador, e aí não há taxa."
        />

        <CartaoIndicador
          titulo="Ticket médio"
          valor={formatMoneyRounded(dinheiro.ticketMedioCents)}
          apoio={`em ${plural(dinheiro.atendimentos, 'atendimento', 'atendimentos')}`}
          explicacao="Faturamento ÷ número de atendimentos concluídos. Falta e cancelamento ficam de fora do divisor: eles têm taxa própria e derrubariam o ticket sem que nenhum preço tivesse mudado."
        />

        <CartaoIndicador
          titulo="Taxa de falta"
          valor={ouTraco(comportamento.taxaFalta)}
          apoio={
            dinheiro.perdidoCents > 0
              ? `${formatMoneyRounded(dinheiro.perdidoCents)} perdidos com quem não veio`
              : 'Ninguém faltou no período'
          }
          explicacao="Faltas ÷ (atendidos + faltas). Cancelamento não entra no divisor: quem cancela devolve o horário para a grade, quem falta deixa a cadeira parada. Sem nenhum atendido e nenhuma falta não há do que tirar taxa."
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
              {/* Este leva centavo: comissão é o número que o barbeiro
                  confere, e arredondar aqui é a divergência que a
                  funcionalidade existe para evitar. */}
              <strong className="tabular-nums">{formatMoney(totalDeComissaoCents)}</strong>{' '}
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
          // O denominador é a **coorte madura**, não os estreantes: em Hoje,
          // Semana e Mês ninguém teve 90 dias para voltar ainda, e guardar este
          // card com `novos === 0` estampava `0%` de retorno na tela padrão e
          // nas três opções do seletor, todo dia. Zero por imaturidade de
          // coorte não é zero — é "ainda não dá para saber".
          valor={ouTraco(clientes.taxaRetorno)}
          apoio={apoioDoRetorno(clientes)}
          explicacao={`Dos clientes que estrearam no período, a fração que voltou em até ${JANELA_DE_RETORNO} dias. Só entra na conta quem já teve esses ${JANELA_DE_RETORNO} dias inteiros para voltar — antes disso a coorte ainda não amadureceu, e um percentual ali seria invenção. Por isso a taxa só aparece em períodos que já ficaram para trás.`}
        />
      </div>

      {/* Os outros três do §3.4 do spec. Eram calculados a cada carregamento e
          não apareciam em lugar nenhum — inclusive o de origem, que é o que
          responde se o cliente está agendando sozinho. */}
      <ComportamentoEOrigem comportamento={comportamento} />
    </div>
  );
}
