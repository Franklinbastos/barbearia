import { FATOR_DE_SUMICO, emDias, intervalos, mediana, visitasDistintas } from './cliente';

/**
 * Os quatro números da ficha de um cliente.
 *
 * Cada um tem dono no mercado, e é por isso que são estes: **total gasto** é o
 * rótulo universal do setor (Fresha, Phorest, Vagaro, Booksy, todos mostram);
 * **taxa de falta** a Booksy mostra, e é a única que mostra taxa em vez de
 * contagem; o **ritmo por mediana** a Phorest calcula por cliente depois de
 * três visitas, exatamente como nós; e **preferidos** é o que o dono já sabe de
 * cor sobre quem ele atende há anos, e não sabe sobre quem chegou este mês.
 *
 * **`null` não é zero, e a diferença é a tela inteira.** "0% de falta" e "nunca
 * teve chance de faltar" são coisas diferentes; "corta a cada 0 dias" não é
 * frase. Onde falta base o campo é `null` e a tela mostra traço.
 *
 * **Sem I/O e sem consulta nova.** Tudo sai do histórico que
 * `listCustomerHistory` já devolve, somado em memória — a única coisa que
 * faltava na query era o nome do barbeiro.
 */

export type AtendimentoDoCliente = {
  startAt: Date;
  status: 'BOOKED' | 'DONE' | 'NO_SHOW' | 'CANCELED';
  serviceName: string;
  priceCents: number;
  staffName: string;
};

export type PerfilDoCliente = {
  /** Soma dos DONE, em centavos. Só o que foi atendido virou dinheiro. */
  totalGastoCents: number;
  /** Quantos DONE. É o "em N atendimentos" do cartão. */
  atendimentos: number;
  /** Mediana dos intervalos entre visitas, em dias. `null` com menos de 2 visitas. */
  intervaloTipico: number | null;
  /** A última visita concluída. `null` se nunca veio. */
  ultimaVisita: Date | null;
  /** Dias desde a última visita. `null` se nunca veio. */
  diasSemVir: number | null;
  /** NO_SHOW / (DONE + NO_SHOW). `null` quando a base é zero — traço, nunca 0%. */
  taxaDeFalta: number | null;
  faltas: number;
  /** O mais frequente entre os DONE. `null` no empate ou sem base. */
  servicoPreferido: string | null;
  barbeiroPreferido: string | null;
  /** `true` quando passou de 1,5× o próprio ritmo. Mesma regra de `listarSumidos`. */
  sumido: boolean;
};

/**
 * O piso para chamar de "sumido" — o mesmo de `listarSumidos`.
 *
 * Com duas visitas há um único intervalo, que tanto pode ser o ritmo da pessoa
 * quanto coincidência. O ritmo aparece na ficha assim mesmo (é informação
 * honesta: "veio duas vezes, com 15 dias entre elas"), mas o selo de sumido,
 * que pede ação, espera a terceira. É o que a Phorest faz.
 */
const VISITAS_PARA_TER_RITMO = 3;

/**
 * O mais repetido da lista, ou `null` quando ninguém ganha.
 *
 * **Empate não elege.** Quem fez um corte e uma barba não tem serviço
 * preferido, e escolher um dos dois por ordem de chegada seria inventar uma
 * preferência que o cliente não tem — o dono confere isso na hora e perde a
 * confiança no cartão inteiro.
 */
function maisFrequente(valores: string[]): string | null {
  const contagem = new Map<string, number>();
  for (const valor of valores) contagem.set(valor, (contagem.get(valor) ?? 0) + 1);

  let campeao: string | null = null;
  let maior = 0;
  let empatado = false;

  for (const [valor, quantas] of contagem) {
    if (quantas > maior) {
      campeao = valor;
      maior = quantas;
      empatado = false;
    } else if (quantas === maior) {
      empatado = true;
    }
  }

  return empatado ? null : campeao;
}

/**
 * O perfil de um cliente a partir do histórico dele.
 *
 * O que conta em cada número:
 *
 * - **Dinheiro e atendimentos**: só `DONE`. O agendado de amanhã ainda não
 *   aconteceu e a falta não rendeu nada.
 * - **Ritmo e ausência**: as visitas concluídas, passadas por
 *   `visitasDistintas` — corte e barba na mesma cadeira são uma ida, não duas,
 *   senão o intervalo de zero dia derruba a mediana pela metade.
 * - **Falta**: `NO_SHOW` sobre `DONE + NO_SHOW`. **Cancelado fica de fora**: o
 *   horário voltou para a grade e ninguém deixou a cadeira vazia — é a mesma
 *   regra de status que `ocupacao.ts` usa.
 *
 * `agora` é parâmetro, e não `Date.now()` de dentro, pelo mesmo motivo de
 * `calcularClientes`: é o que torna "sumido" testável, e a tela deve passar o
 * mesmo instante que usa no resto da página.
 */
export function calcularPerfilDoCliente(
  atendimentos: AtendimentoDoCliente[],
  agora: Date,
): PerfilDoCliente {
  const feitos = atendimentos.filter((a) => a.status === 'DONE');
  const faltas = atendimentos.filter((a) => a.status === 'NO_SHOW').length;
  const baseDeFalta = feitos.length + faltas;

  const visitas = visitasDistintas(feitos.map((a) => a.startAt));
  // O ritmo cru, sem arredondar: é ele que entra na comparação do sumiço, para
  // que a ficha e a lista de sumidos nunca discordem por meio dia.
  const ritmo = visitas.length >= 2 ? mediana(intervalos(visitas)) : null;

  const ultimaVisita = visitas.length > 0 ? visitas[visitas.length - 1] : null;
  const ausencia = ultimaVisita === null ? null : emDias(ultimaVisita, agora);

  return {
    totalGastoCents: feitos.reduce((soma, a) => soma + a.priceCents, 0),
    atendimentos: feitos.length,
    intervaloTipico: ritmo === null ? null : Math.round(ritmo),
    ultimaVisita,
    // Um `DONE` com hora futura é defeito de dado, não motivo para a tela
    // mostrar "sumido há -2 dias".
    diasSemVir: ausencia === null ? null : Math.max(0, Math.round(ausencia)),
    taxaDeFalta: baseDeFalta === 0 ? null : faltas / baseDeFalta,
    faltas,
    servicoPreferido: maisFrequente(feitos.map((a) => a.serviceName)),
    barbeiroPreferido: maisFrequente(feitos.map((a) => a.staffName)),
    sumido:
      visitas.length >= VISITAS_PARA_TER_RITMO &&
      ritmo !== null &&
      ritmo > 0 &&
      ausencia !== null &&
      ausencia > ritmo * FATOR_DE_SUMICO,
  };
}
