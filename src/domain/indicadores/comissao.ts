import type { AtendimentoBruto } from './dinheiro';

/**
 * Comissão por barbeiro e o detalhe atendimento a atendimento (§4 do spec).
 *
 * É **o número central da operação** — a maior despesa da barbearia, maior que
 * o aluguel — e o único indicador da Fase 1 que precisa de configuração.
 *
 * **A regra que sustenta o módulo inteiro: o total é a soma das linhas.** Se o
 * total fosse `base × percentual` e o detalhe fosse calculado linha a linha, os
 * dois divergiriam em centavos por arredondamento — e é justamente na
 * conferência linha a linha que o barbeiro vai olhar. Divergência de centavo
 * destrói a confiança na funcionalidade inteira, que existe exatamente para
 * encerrar a discussão do fechamento. Por isso há uma única função que
 * arredonda (`comissaoDoAtendimento`), e tanto o total quanto o detalhe passam
 * por ela, uma vez por atendimento.
 *
 * **O que entra na base:** o bruto `DONE` do barbeiro no período, com o preço
 * congelado no agendamento. `NO_SHOW` e `CANCELED` não geram comissão — não
 * houve serviço prestado —, e `BOOKED` também não: ainda não foi atendido, e
 * pagar por agenda cheia é pagar duas vezes quando o cliente falta.
 *
 * **Percentual nulo não é zero.** Nulo é "este barbeiro não trabalha por
 * comissão" (o dono que não tira, quem aluga a cadeira), e a linha **some** do
 * relatório. Zero é uma configuração de verdade — alguém digitou 0 —, e aparece
 * zerada. Tratar os dois igual esconderia o barbeiro sem configuração no meio
 * de quem não tem comissão mesmo, que é o erro que a tela precisa evitar.
 *
 * Sem I/O, como todo o resto de `src/domain/indicadores/`: recebe o que o
 * repositório leu e devolve número.
 */

/** O barbeiro como a comissão o enxerga: nome, percentual e se ainda trabalha ali. */
export type BarbeiroComissionado = {
  id: string;
  nome: string;
  /** Se continua na equipe. Desativado só entra no fechamento se produziu. */
  ativo: boolean;
  /** Inteiro de 0 a 100. `null` = sem comissão, e some do relatório. */
  percentual: number | null;
};

/**
 * O mínimo de que a comissão precisa de um atendimento.
 *
 * Estrutural de propósito: `AtendimentoBruto` (que é o que a tela de resumo já
 * tem em mãos) satisfaz isto sem conversão nenhuma, e a tela de detalhe
 * acrescenta os dois rótulos que só ela desenha — serviço e cliente — sem que o
 * resumo precise carregá-los.
 */
export type ItemDeComissao = Pick<
  AtendimentoBruto,
  'id' | 'staffId' | 'startAt' | 'status' | 'precoCents'
> & {
  /** Nome do serviço no snapshot. Ausente no resumo, presente no detalhe. */
  servico?: string;
  cliente?: string;
};

export type ComissaoDoBarbeiro = {
  staffId: string;
  nome: string;
  /** O percentual efetivamente aplicado, já dentro de 0 a 100. */
  percentual: number;
  /** O bruto que ele produziu no período, em centavos. */
  baseCents: number;
  /** A soma das comissões linha a linha — nunca o percentual sobre a base. */
  comissaoCents: number;
  atendimentos: number;
};

export type LinhaDeComissao = {
  appointmentId: string;
  quando: Date;
  servico: string;
  cliente: string;
  precoCents: number;
  comissaoCents: number;
};

/** Sem rótulo o traço é mais honesto que um nome inventado. */
const SEM_ROTULO = '—';

/** Só o atendimento concluído gera comissão (§4 do spec). */
function gerouComissao(item: ItemDeComissao): boolean {
  return item.status === 'DONE';
}

/**
 * Mantém o percentual dentro de 0 a 100, mesmo que o banco traga outra coisa.
 *
 * A validação de verdade é da action que grava; esta é a segunda tranca. Um
 * `-10` ou um `400` vindo de uma linha antiga não pode virar comissão negativa
 * nem quádrupla num relatório que o barbeiro vai usar para receber.
 */
function percentualValido(percentual: number): number {
  if (!Number.isFinite(percentual)) return 0;
  return Math.min(100, Math.max(0, percentual));
}

/**
 * A comissão de **um** atendimento, arredondada para baixo.
 *
 * Único lugar do produto que arredonda comissão. Para baixo porque o centavo
 * quebrado a mais é dinheiro que a barbearia paga sem ter cobrado, e porque
 * "sempre para baixo" é a regra que o barbeiro consegue conferir de cabeça —
 * arredondamento bancário daria dois resultados diferentes para o mesmo valor.
 */
export function comissaoDoAtendimento(precoCents: number, percentual: number): number {
  return Math.floor((precoCents * percentualValido(percentual)) / 100);
}

/**
 * Uma linha por barbeiro **comissionado**, ordenada da maior comissão para a
 * menor.
 *
 * Barbeiro **da equipe** com percentual e sem atendimento no período continua
 * aparecendo, zerado: no fechamento, "o João não produziu nada nesta semana" é
 * resposta, e a linha que some parece relatório quebrado. Quem some é o de
 * percentual nulo, que não trabalha por comissão.
 *
 * **E some também o desativado que não produziu no período** — a mesma regra da
 * tabela por barbeiro do resumo. Quem saiu em março não polui o fechamento de
 * agosto com uma linha zerada que parece haver algo a pagar; o fechamento de
 * março continua mostrando o que ele fez, e a comissão que ele tem a receber.
 *
 * Atendimento de quem não está na lista de barbeiros (desativado, ou de outra
 * barbearia se alguém errar o escopo da consulta) é ignorado — o relatório não
 * inventa linha para id que não sabe nomear.
 */
export function calcularComissao(
  itens: ItemDeComissao[],
  barbeiros: BarbeiroComissionado[],
): ComissaoDoBarbeiro[] {
  const porStaff = new Map<string, ItemDeComissao[]>();
  for (const item of itens) {
    if (!gerouComissao(item)) continue;
    porStaff.set(item.staffId, [...(porStaff.get(item.staffId) ?? []), item]);
  }

  return barbeiros
    .filter((barbeiro) => barbeiro.percentual !== null)
    .filter((barbeiro) => barbeiro.ativo || (porStaff.get(barbeiro.id)?.length ?? 0) > 0)
    .map((barbeiro) => {
      const percentual = percentualValido(barbeiro.percentual!);
      const doBarbeiro = porStaff.get(barbeiro.id) ?? [];

      let baseCents = 0;
      let comissaoCents = 0;
      for (const item of doBarbeiro) {
        baseCents += item.precoCents;
        // Uma linha por vez, e o total é a soma delas: é o que faz o detalhe
        // bater com o total até o último centavo.
        comissaoCents += comissaoDoAtendimento(item.precoCents, percentual);
      }

      return {
        staffId: barbeiro.id,
        nome: barbeiro.nome,
        percentual,
        baseCents,
        comissaoCents,
        atendimentos: doBarbeiro.length,
      };
    })
    .sort((a, b) => b.comissaoCents - a.comissaoCents || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * O detalhe do fechamento: uma linha por atendimento, em ordem cronológica.
 *
 * É isto que resolve o problema real. As quatro brigas típicas do fechamento
 * são divergência de valor, atendimento não registrado, cliente que faltou e o
 * que compõe a base — e as quatro morrem diante de uma lista com data, cliente,
 * serviço, valor e comissão. "Sem registro, não tem argumento", e o registro é
 * o que temos.
 */
export function detalharComissao(
  itens: ItemDeComissao[],
  staffId: string,
  percentual: number,
): LinhaDeComissao[] {
  return itens
    .filter((item) => item.staffId === staffId && gerouComissao(item))
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    .map((item) => ({
      appointmentId: item.id,
      quando: item.startAt,
      servico: item.servico ?? SEM_ROTULO,
      cliente: item.cliente ?? SEM_ROTULO,
      precoCents: item.precoCents,
      comissaoCents: comissaoDoAtendimento(item.precoCents, percentual),
    }));
}
