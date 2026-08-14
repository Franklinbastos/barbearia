import type { AtendimentoBruto } from './dinheiro';

/**
 * Falta, cancelamento e origem do agendamento (§3.4 do spec).
 *
 * Funções puras: recebem a lista já filtrada pela `Janela` e devolvem número.
 */

/** Janela de aviso: cancelar dentro dela é "em cima da hora". */
const HORAS_DE_ANTECEDENCIA = 24;
const MS_EM_CIMA_DA_HORA = HORAS_DE_ANTECEDENCIA * 60 * 60 * 1000;

export type Origem = AtendimentoBruto['origin'];

export type ResumoDeComportamento = {
  /**
   * `NO_SHOW` ÷ (`DONE` + `NO_SHOW`), de 0 a 1, ou **`null` quando não houve
   * nenhum dos dois** — não há do que tirar taxa, e `0%` afirmaria que ninguém
   * faltou de um universo que não existe (§5.12 da direção de UI).
   */
  taxaFalta: number | null;
  /** `CANCELED` ÷ total do período, de 0 a 1, ou `null` num período sem nada. */
  taxaCancelamento: number | null;
  /** Quantos agendamentos o período tem, seja qual for o status. */
  agendamentos: number;
  /** Quantos cancelamentos caíram a menos de 24h do horário marcado. */
  cancelamentoEmCimaDaHora: number;
  /** Quantos agendamentos vieram de cada canal. */
  porOrigem: Record<Origem, number>;
};

/**
 * Taxa de falta, taxa de cancelamento, cancelamento em cima da hora e origem.
 *
 * **O denominador da falta é `DONE + NO_SHOW`, não o total.** Falta e
 * cancelamento são fenômenos diferentes: quem cancela avisa e devolve o horário
 * para a grade, quem falta deixa a cadeira parada. Jogar o cancelado no
 * denominador dilui a falta — uma semana com muitos cancelamentos mostraria
 * taxa de falta menor sem que ninguém tenha comparecido mais. O cancelamento
 * tem taxa própria, e essa sim é sobre o total do período, porque a pergunta
 * ali é "que fatia da minha agenda cai?".
 *
 * **Cancelamento em cima da hora** é o `CANCELED` com `canceledAt` a menos de
 * 24h do `startAt`. Sem `canceledAt` não dá para afirmar nada, e o silêncio
 * conta como não — inventar antecedência com base no que não foi registrado
 * inflaria justamente o número que o dono usaria para cobrar o cliente.
 *
 * **Origem** conta todos os agendamentos do período, seja qual for o status:
 * a pergunta é por qual canal o horário foi marcado, e o cliente que marcou
 * sozinho e depois cancelou marcou sozinho do mesmo jeito.
 */
export function calcularComportamento(itens: AtendimentoBruto[]): ResumoDeComportamento {
  let atendidos = 0;
  let faltas = 0;
  let cancelados = 0;
  let cancelamentoEmCimaDaHora = 0;
  const porOrigem: Record<Origem, number> = { PUBLIC: 0, PANEL: 0, BOT: 0 };

  for (const item of itens) {
    porOrigem[item.origin] += 1;

    if (item.status === 'DONE') {
      atendidos += 1;
      continue;
    }

    if (item.status === 'NO_SHOW') {
      faltas += 1;
      continue;
    }

    if (item.status === 'CANCELED') {
      cancelados += 1;
      if (
        item.canceledAt !== null &&
        item.startAt.getTime() - item.canceledAt.getTime() < MS_EM_CIMA_DA_HORA
      ) {
        cancelamentoEmCimaDaHora += 1;
      }
    }
  }

  const compareceram = atendidos + faltas;

  return {
    // `null` em vez de zero: período sem atendido nem falta não tem taxa, e
    // quem decide como desenhar isso é a tela — que põe traço. Devolver zero
    // aqui obrigava cada chamador a recalcular o denominador por fora para
    // saber se aquele zero era resultado ou ausência, e um deles ia esquecer.
    taxaFalta: compareceram === 0 ? null : faltas / compareceram,
    taxaCancelamento: itens.length === 0 ? null : cancelados / itens.length,
    agendamentos: itens.length,
    cancelamentoEmCimaDaHora,
    porOrigem,
  };
}
