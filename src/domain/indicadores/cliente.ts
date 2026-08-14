import type { Janela } from './periodo';

/**
 * Indicadores de cliente (§3.3 do spec).
 *
 * **A definição de "cliente sumido" é o valor deste módulo**, e é o que separa
 * lista útil de lista inútil. Nada de "não vem há 30 dias", que é o que quase
 * todo mundo faz: o corte é **1,5× o intervalo típico daquele cliente**. Quem
 * corta a cada 15 dias e sumiu há 40 é urgente; quem corta a cada 60 e sumiu há
 * 40 está no ritmo. É esse segundo caso que a regra dos 30 dias erra, e é o
 * motivo da métrica existir.
 *
 * **Sem I/O.** Tudo aqui recebe o histórico pronto como argumento e devolve
 * número — é o que permite testar a definição inteira em milissegundos, sem
 * Postgres. Quem busca é `listarHistoricoDeClientes` no repositório.
 *
 * **Sobre fuso:** as contas de intervalo são em milissegundos, não em dia
 * civil. Uma virada de horário de verão faz um intervalo de 15 dias virar
 * 14,96 — e isso não muda nada, porque a comparação é uma razão contra a
 * mediana do próprio cliente (que sofre o mesmo desvio) e o que vai para a tela
 * é arredondado. Dia civil só importaria se o corte fosse uma data fixa, e não
 * é.
 */

export type VisitaDoCliente = {
  customerId: string;
  nome: string;
  telefone: string;
  /** Todos os atendimentos concluídos dele, em qualquer ordem. */
  visitas: Date[];
};

export type ClienteSumido = {
  customerId: string;
  nome: string;
  telefone: string;
  ultimaVisita: Date;
  /** A mediana dos intervalos dele, em dias inteiros — o "corta a cada X". */
  intervaloTipico: number;
  /** Quantos dias além do próprio ritmo ele já está ausente. */
  diasAtraso: number;
};

export type ClienteDeUmaVezSo = {
  customerId: string;
  nome: string;
  telefone: string;
  unicaVisita: Date;
};

export type IndicadoresDeCliente = {
  /** Clientes distintos com pelo menos um atendimento na janela. */
  atendidos: number;
  /** Destes, quantos tiveram a primeira visita da vida dentro da janela. */
  novos: number;
  /** Os outros — já tinham vindo antes. */
  recorrentes: number;
  /** Média dos intervalos que se fecharam na janela, ou `null` sem histórico. */
  diasEntreVisitas: number | null;
  /** Fração de 0 a 1. Ver `calcularClientes` para o que entra no denominador. */
  taxaRetorno: number;
};

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * O múltiplo do ritmo do cliente a partir do qual ele conta como sumido.
 * 1,5× é o que Phorest e Gendo usam, e é o que a pesquisa registrou.
 */
export const FATOR_DE_SUMICO = 1.5;

/**
 * O intervalo de referência, em dias, para quem não tem ritmo próprio — só
 * serve a `listarVieramUmaVezSo`, onde não há dois atendimentos para medir.
 * Aplicado o mesmo `FATOR_DE_SUMICO`, dá o corte de 45 dias.
 */
export const INTERVALO_TIPICO_PADRAO = 30;

/** Janela da coorte de retorno, em dias — "voltou em até 90 dias" (§3.3). */
export const JANELA_DE_RETORNO = 90;

function emDias(de: Date, ate: Date): number {
  return (ate.getTime() - de.getTime()) / MS_POR_DIA;
}

/**
 * Ordena as visitas e funde as que estão a menos de um dia uma da outra.
 *
 * A fusão não é preciosismo: cabelo e barba entram na agenda como dois
 * atendimentos, e o segundo produziria um intervalo de zero dias. Um zero
 * dentro da mediana derruba o ritmo do cliente pela metade e joga na lista de
 * sumidos gente que está em dia — exatamente o erro que a métrica existe para
 * evitar.
 */
function visitasDistintas(visitas: Date[]): Date[] {
  const ordenadas = [...visitas].sort((a, b) => a.getTime() - b.getTime());
  const distintas: Date[] = [];

  for (const visita of ordenadas) {
    const anterior = distintas[distintas.length - 1];
    if (anterior && emDias(anterior, visita) < 1) continue;
    distintas.push(visita);
  }

  return distintas;
}

/** Os intervalos, em dias, entre visitas consecutivas já normalizadas. */
function intervalos(visitas: Date[]): number[] {
  const dias: number[] = [];
  for (let i = 1; i < visitas.length; i += 1) dias.push(emDias(visitas[i - 1], visitas[i]));
  return dias;
}

/**
 * A mediana — e não a média, que é o detalhe que faz a métrica funcionar.
 *
 * Com intervalos de 15, 15, 15 e 90 dias, a média dá 34 e o corte vira 51,
 * deixando passar quem sumiu. A mediana dá 15 e o corte vira 22.
 */
function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1
    ? ordenados[meio]
    : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

/**
 * Quem passou de 1,5× o próprio intervalo típico sem aparecer.
 *
 * Precisa de **3 visitas ou mais**: com duas há um único intervalo, que tanto
 * pode ser o ritmo da pessoa quanto uma coincidência, e chamar isso de ritmo
 * enche a lista de falso positivo. Quem tem menos vai para
 * `listarVieramUmaVezSo`.
 *
 * A ordenação é por **quão atrasado está em relação ao próprio ritmo** — a
 * razão entre a ausência e o intervalo típico —, não pelo mais antigo. Quem
 * corta a cada 10 dias e sumiu há 50 (5×) vem antes de quem corta a cada 30 e
 * sumiu há 60 (2×), porque é dele que se perdeu mais corte.
 */
export function listarSumidos(historico: VisitaDoCliente[], agora: Date): ClienteSumido[] {
  const sumidos: (ClienteSumido & { razao: number })[] = [];

  for (const cliente of historico) {
    const visitas = visitasDistintas(cliente.visitas);
    if (visitas.length < 3) continue;

    const intervaloTipico = mediana(intervalos(visitas));
    if (intervaloTipico <= 0) continue;

    const ultimaVisita = visitas[visitas.length - 1];
    const ausencia = emDias(ultimaVisita, agora);
    if (ausencia <= intervaloTipico * FATOR_DE_SUMICO) continue;

    sumidos.push({
      customerId: cliente.customerId,
      nome: cliente.nome,
      telefone: cliente.telefone,
      ultimaVisita,
      intervaloTipico: Math.round(intervaloTipico),
      // O atraso é contra o ritmo dele, não contra o corte: é o número que a
      // tela consegue explicar em uma frase ("corta a cada 15, sumiu há 40").
      diasAtraso: Math.max(1, Math.round(ausencia - intervaloTipico)),
      razao: ausencia / intervaloTipico,
    });
  }

  return sumidos
    .sort((a, b) => b.razao - a.razao || b.diasAtraso - a.diasAtraso || a.nome.localeCompare(b.nome, 'pt-BR'))
    .map(({ razao: _razao, ...cliente }) => cliente);
}

/**
 * Quem veio uma vez e não voltou — outro problema, outra conversa.
 *
 * Sem uma segunda visita não há ritmo nenhum para medir, então o corte usa o
 * intervalo de referência da casa (`INTERVALO_TIPICO_PADRAO`) com o mesmo
 * `FATOR_DE_SUMICO`: 45 dias. Quem estreou ontem ainda não é caso perdido, e
 * cobrar retorno dele seria só afobação.
 *
 * **Fica de fora quem tem exatamente duas visitas**: não entra aqui, porque
 * voltou, nem em `listarSumidos`, porque não tem ritmo. É uma lacuna
 * consciente — a terceira lista só se justifica se o dono pedir.
 */
export function listarVieramUmaVezSo(
  historico: VisitaDoCliente[],
  agora: Date,
): ClienteDeUmaVezSo[] {
  const corte = INTERVALO_TIPICO_PADRAO * FATOR_DE_SUMICO;

  return historico
    .map((cliente) => ({ cliente, visitas: visitasDistintas(cliente.visitas) }))
    .filter(({ visitas }) => visitas.length === 1 && emDias(visitas[0], agora) > corte)
    .sort((a, b) => a.visitas[0].getTime() - b.visitas[0].getTime())
    .map(({ cliente, visitas }) => ({
      customerId: cliente.customerId,
      nome: cliente.nome,
      telefone: cliente.telefone,
      unicaVisita: visitas[0],
    }));
}

function dentroDaJanela(quando: Date, janela: Janela): boolean {
  // `fim` é exclusivo, como em toda a casa (ver `periodo.ts`).
  return quando >= janela.inicio && quando < janela.fim;
}

/**
 * Os números do card de Clientes, para a janela escolhida.
 *
 * - **atendidos**: clientes distintos com visita na janela.
 * - **novos**: destes, quem teve a primeira visita **da vida** dentro dela. Na
 *   prática "da vida" é o quanto de histórico foi carregado (um ano), e é o
 *   melhor que dá para afirmar sem varrer a tabela inteira.
 * - **recorrentes**: o resto — já tinham vindo antes.
 * - **diasEntreVisitas**: a média dos intervalos que **se fecharam na janela** —
 *   para cada visita do período, quanto tempo o cliente passou fora antes dela.
 *   Assim o número responde ao seletor de período como os outros cards, e quem
 *   só veio uma vez fica naturalmente de fora, por não ter intervalo nenhum.
 *   Sem nenhum intervalo devolve **`null`, nunca zero** — zero dia entre visitas
 *   diria que a barbearia atende todo mundo todo dia.
 * - **taxaRetorno**: dos clientes que estrearam na janela, a fração que voltou
 *   em até 90 dias. Só entra no denominador quem já teve esses 90 dias para
 *   voltar, contados **até `agora`** — não até o fim da janela, e não abrindo
 *   exceção para quem já voltou. As duas tentações levam ao mesmo lugar: uma
 *   coorte formada só por quem voltou marca 100% de retorno, porque o
 *   denominador virou o numerador. Enquanto a coorte não amadurece o certo é
 *   não haver taxa; com o denominador vazio devolve 0, e cabe à tela não
 *   mostrar percentual de coorte que ainda não existe.
 *
 * `agora` é parâmetro, e não `Date.now()` de dentro, porque é o que torna a
 * maturidade da coorte testável. O padrão existe para a chamada trivial, mas a
 * tela deve passar o mesmo instante que usa nos outros cards.
 */
export function calcularClientes(
  historico: VisitaDoCliente[],
  janela: Janela,
  agora: Date = new Date(),
): IndicadoresDeCliente {
  let atendidos = 0;
  let novos = 0;
  let intervalosFechados = 0;
  let somaDosIntervalos = 0;
  let coorte = 0;
  let voltaram = 0;

  for (const cliente of historico) {
    const visitas = visitasDistintas(cliente.visitas);
    if (visitas.length === 0) continue;

    const naJanela = visitas.filter((visita) => dentroDaJanela(visita, janela));
    if (naJanela.length > 0) {
      atendidos += 1;
      if (dentroDaJanela(visitas[0], janela)) novos += 1;
    }

    for (let i = 1; i < visitas.length; i += 1) {
      if (!dentroDaJanela(visitas[i], janela)) continue;
      somaDosIntervalos += emDias(visitas[i - 1], visitas[i]);
      intervalosFechados += 1;
    }

    if (dentroDaJanela(visitas[0], janela)) {
      // Entra na coorte quem estreou na janela e já teve os 90 dias inteiros
      // para voltar. Quem estreou anteontem não conta nem como sucesso nem
      // como fracasso — ainda está dentro do prazo.
      const coorteMadura = emDias(visitas[0], agora) >= JANELA_DE_RETORNO;
      if (coorteMadura) {
        coorte += 1;
        const segunda = visitas[1];
        if (segunda !== undefined && emDias(visitas[0], segunda) <= JANELA_DE_RETORNO) {
          voltaram += 1;
        }
      }
    }
  }

  return {
    atendidos,
    novos,
    recorrentes: atendidos - novos,
    diasEntreVisitas:
      intervalosFechados === 0 ? null : Math.round(somaDosIntervalos / intervalosFechados),
    taxaRetorno: coorte === 0 ? 0 : voltaram / coorte,
  };
}
