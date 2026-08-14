import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Origem, ResumoDeComportamento } from '@/domain/indicadores/comportamento';
import { formatPercent } from '@/lib/format';
import { tituloDoIndicadorVariants } from './cartao-indicador';
import { ExplicacaoDoCalculo } from './explicacao-do-calculo';

/**
 * Cancelamento, cancelamento em cima da hora e origem do agendamento — os três
 * indicadores do §3.4 do spec que faltavam na tela.
 *
 * `calcularComportamento` devolvia os quatro desde o começo, e só a taxa de
 * falta tinha lugar: os outros três eram calculados a cada carregamento da
 * página e jogados fora. **O de origem é o mais caro dos três**, porque é o
 * único número do produto que responde se o cliente está agendando sozinho — e
 * "se esse número não subir com o tempo, o produto não está funcionando" (§3.4).
 *
 * **Um card, três números, e não três cards.** A primeira dobra é a hierarquia
 * da tela: quatro cards de 34px que o dono lê de longe. Estes três são de
 * segunda leitura, e promovê-los ao mesmo peso tiraria força justamente do
 * faturamento e da ocupação. Por isso o número aqui é o `xl` da escala (22/28),
 * não o `3xl` do `CartaoIndicador` — mas cada um mantém a explicação do
 * cálculo, que é obrigatória em qualquer indicador (§5.12).
 */

/** O que a origem responde, em número e em lastro. */
export type ResumoDeOrigem = {
  /**
   * Fração dos agendamentos que o próprio cliente marcou — público mais bot.
   * `null` num período sem agendamento nenhum: sem denominador não há taxa.
   */
  fracaoSozinho: number | null;
  /** "4 pelo link · 1 pelo bot · 5 no balcão" — só os canais que tiveram algo. */
  detalhe: string;
};

const ROTULO_DA_ORIGEM: { origem: Origem; rotulo: string }[] = [
  // O que o cliente fez sozinho vem primeiro, que é a pergunta do indicador.
  { origem: 'PUBLIC', rotulo: 'pelo link' },
  { origem: 'BOT', rotulo: 'pelo bot' },
  { origem: 'PANEL', rotulo: 'no balcão' },
];

export function resumirOrigem(porOrigem: Record<Origem, number>): ResumoDeOrigem {
  const total = porOrigem.PUBLIC + porOrigem.PANEL + porOrigem.BOT;
  const sozinho = porOrigem.PUBLIC + porOrigem.BOT;

  const detalhe = ROTULO_DA_ORIGEM.filter(({ origem }) => porOrigem[origem] > 0)
    .map(({ origem, rotulo }) => `${porOrigem[origem]} ${rotulo}`)
    .join(' · ');

  return {
    fracaoSozinho: total === 0 ? null : sozinho / total,
    detalhe: detalhe === '' ? 'nenhum agendamento no período' : detalhe,
  };
}

/** Traço, nunca zero: é a diferença entre "não houve" e "foi zero" (§5.12). */
function ouTraco(fracao: number | null): string {
  return fracao === null ? '—' : formatPercent(fracao);
}

function Numero({
  titulo,
  valor,
  apoio,
  explicacao,
}: {
  titulo: string;
  valor: string;
  apoio: string;
  explicacao: string;
}) {
  return (
    <div data-slot="numero-de-comportamento" className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className={tituloDoIndicadorVariants()}>{titulo}</h3>
        <ExplicacaoDoCalculo de={titulo} texto={explicacao} />
      </div>
      <p className="text-[22px] leading-7 font-bold tabular-nums">{valor}</p>
      <p className="text-sm leading-5 text-muted-foreground">{apoio}</p>
    </div>
  );
}

export type ComportamentoEOrigemProps = {
  comportamento: ResumoDeComportamento;
};

export function ComportamentoEOrigem({ comportamento }: ComportamentoEOrigemProps) {
  const origem = resumirOrigem(comportamento.porOrigem);

  return (
    <Card data-slot="comportamento-e-origem">
      <CardHeader>
        <CardTitle>Cancelamento e origem</CardTitle>
        <CardDescription>
          Quanto da agenda cai, quanto cai sem tempo de revender e por qual caminho o horário foi
          marcado.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Numero
          titulo="Cancelamento"
          valor={ouTraco(comportamento.taxaCancelamento)}
          apoio={`de ${comportamento.agendamentos} ${
            comportamento.agendamentos === 1 ? 'agendamento' : 'agendamentos'
          } no período`}
          explicacao="Cancelados ÷ total de agendamentos do período, seja qual for o status dos outros. A pergunta aqui é que fatia da agenda cai — diferente da taxa de falta, que mede quem não avisou."
        />

        <Numero
          titulo="Em cima da hora"
          valor={String(comportamento.cancelamentoEmCimaDaHora)}
          apoio="cancelados a menos de 24 h do horário"
          explicacao="Cancelamentos registrados a menos de 24 h do horário marcado. É o que não dá tempo de revender: a cadeira fica vaga do mesmo jeito. Cancelamento sem hora registrada não entra — inventar antecedência inflaria o número que o dono usaria para cobrar o cliente."
        />

        <Numero
          titulo="Agendou sozinho"
          valor={ouTraco(origem.fracaoSozinho)}
          apoio={origem.detalhe}
          explicacao="Fatia dos agendamentos que o próprio cliente marcou, pelo link ou pelo bot, contra os que o balcão digitou. É o número que diz se o produto está tirando trabalho de você — se ele não sobe com o tempo, o link não está chegando ao cliente."
        />
      </CardContent>
    </Card>
  );
}
