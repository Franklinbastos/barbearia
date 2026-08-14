import { DateTime } from 'luxon';
import type { Janela } from './periodo';
import type { AtendimentoBruto } from './dinheiro';

/**
 * Taxa de ocupação (§3.2 do spec) — o diferencial da tela, e a conta que mais
 * erra calado no produto inteiro.
 *
 * **Denominador errado não quebra teste nem estoura tela.** Mostra 45% onde é
 * 80%, o dono acredita, e decide errado com um número que parece certo. Por
 * isso as quatro regras do denominador estão escritas aqui em cima, e cada uma
 * tem teste próprio:
 *
 * 1. **Disponível é o expediente do dia**, `working_hours` do `weekday`
 *    correspondente — não 24 horas, não "das 8 às 20" por convenção.
 * 2. **Bloqueio sai do disponível, só na parte que intersecta.** Hora em que o
 *    barbeiro não estava lá não conta contra ele; e um `time_off` das 7 às 10
 *    num expediente que abre às 9 desconta uma hora, não três.
 * 3. **O que ainda não chegou não é disponível.** Às 10h de um dia que fecha às
 *    18h, contar a tarde inteira como ociosa derruba o número sem motivo — a
 *    tarde ainda pode ser vendida.
 * 4. **Dia sem expediente não entra**, e sem denominador **não há taxa**: a
 *    função devolve `null`, nunca `0` e nunca `NaN`. Loja fechada no domingo
 *    não é domingo com 0% de ocupação — é domingo sem número, e quem desenha
 *    isso é a tela, com traço.
 *
 * **Numerador**, e este é o ponto do indicador: `BOOKED` e `DONE` ocupam, e
 * **`NO_SHOW` ocupa também** — a cadeira ficou reservada e ninguém pôde usar,
 * que é exatamente o prejuízo que o dono precisa enxergar. `CANCELED` não
 * ocupa, porque o horário voltou para a grade e podia ter sido vendido de novo.
 *
 * Função pura: recebe o que o repositório leu e devolve número. É o que permite
 * testar borda de fuso, dia em curso e bloqueio sobreposto em milissegundos.
 */

/** Um bloco de `working_hours`: hora **local** da loja, sem data. */
export type BlocoDeTrabalho = {
  staffId: string;
  /** 1 = segunda … 7 = domingo, a mesma numeração do `weekday` do Luxon. */
  weekday: number;
  /** `'09:00:00'` — relógio de parede, nunca instante. */
  startTime: string;
  /** `'18:00:00'`, exclusivo. `'24:00:00'` fecha na meia-noite seguinte. */
  endTime: string;
};

/** Um `time_off`: instantes absolutos, ao contrário do expediente. */
export type Bloqueio = { staffId: string; startAt: Date; endAt: Date };

export type OcupacaoDoBarbeiro = {
  disponiveis: number;
  ocupados: number;
  /** De 0 a 1, ou `null` para quem não tem expediente cadastrado na janela. */
  taxa: number | null;
};

export type Ocupacao = {
  minutosDisponiveis: number;
  minutosOcupados: number;
  /**
   * De 0 a 1, ou **`null` sem expediente no período**: loja fechada no domingo
   * não é domingo com 0% de ocupação, e a tela precisa distinguir os dois para
   * mostrar traço em vez de acusar a cadeira de estar parada.
   */
  taxa: number | null;
  porBarbeiro: Map<string, OcupacaoDoBarbeiro>;
  /** Só os dias da semana que têm expediente na janela, em ordem. */
  porDiaDaSemana: { weekday: number; taxa: number }[];
  /** Só as horas locais que têm expediente na janela, em ordem. */
  porHora: { hora: number; taxa: number }[];
};

export type CalcularOcupacaoArgs = {
  itens: AtendimentoBruto[];
  expediente: BlocoDeTrabalho[];
  bloqueios: Bloqueio[];
  janela: Janela;
  timeZone: string;
  agora: Date;
};

/** `CANCELED` é o único que devolve o horário para a grade. */
const OCUPAM = new Set<AtendimentoBruto['status']>(['BOOKED', 'DONE', 'NO_SHOW']);

/** Intervalo absoluto, em milissegundos, com o fim exclusivo. */
type Trecho = { inicio: number; fim: number };

/** Trecho de expediente já disponível, com o de-onde-veio que os recortes usam. */
type TrechoDisponivel = Trecho & { staffId: string; weekday: number };

const HORA_LOCAL = /^(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/;

/**
 * `'09:00:00'` no dia `dia` → instante absoluto no fuso da loja.
 *
 * A conversão é **por dia**, e não somando minutos em cima da meia-noite: no
 * dia em que o relógio vira, os dois resultados divergem em uma hora, e é
 * justamente esse dia que a conta existe para acertar. Mesmo idioma de
 * `src/domain/availability/compute.ts`.
 *
 * `'24:00:00'` é como o Postgres aceita a meia-noite do fim do expediente, e
 * cai na meia-noite do dia seguinte em vez de virar hora inválida.
 */
function instanteDoDia(dia: DateTime, hora: string): DateTime | null {
  const casou = HORA_LOCAL.exec(hora);
  if (!casou) return null;

  const h = Number(casou[1]);
  const minuto = Number(casou[2]);
  const segundo = casou[3] ? Number(casou[3]) : 0;
  const meiaNoite = dia.startOf('day');

  if (h >= 24) {
    return meiaNoite
      .plus({ days: 1 })
      .startOf('day')
      .plus({ hours: h - 24, minutes: minuto, seconds: segundo });
  }

  const dt = meiaNoite.set({ hour: h, minute: minuto, second: segundo, millisecond: 0 });
  return dt.isValid ? dt : null;
}

/**
 * As duas pontas do bloco naquele dia, já em instante absoluto — e a barreira
 * contra o bloco que este módulo não sabe medir, que antes virava zero minuto.
 *
 * **Por que rejeitar e não tratar.** O produto não suporta expediente que vira
 * a meia-noite: `validateWorkingBlocks` recusa `endTime <= startTime` na
 * gravação, e `computeAvailability` não oferece horário nenhum num bloco desses
 * — ou seja, hora que nem existe para vender. Fazer a ocupação sozinha aceitar
 * 22:00→02:00 abriria um denominador que a agenda nunca consegue preencher, e a
 * taxa cairia sem que a barbearia tivesse ficado mais vazia. Uma linha assim só
 * chega aqui por escrita fora do produto.
 *
 * **E por que não seguir em silêncio**, que é o que acontecia: o bloco sumia,
 * o barbeiro saía do denominador junto e a ocupação da loja subia — sem erro,
 * sem log, sem nada na tela. Número errado que parece certo é o defeito que
 * este módulo inteiro existe para evitar.
 */
function instantesDoBloco(
  dia: DateTime,
  bloco: BlocoDeTrabalho,
): { abre: DateTime; fecha: DateTime } {
  const abre = instanteDoDia(dia, bloco.startTime);
  const fecha = instanteDoDia(dia, bloco.endTime);
  const onde = `barbeiro ${bloco.staffId}, dia ${bloco.weekday}`;

  if (!abre || !fecha) {
    throw new Error(
      `Hora de expediente ilegível (${onde}): "${bloco.startTime}" às "${bloco.endTime}".`,
    );
  }

  if (fecha.toMillis() <= abre.toMillis()) {
    throw new Error(
      `Expediente que vira a meia-noite não é suportado (${onde}): "${bloco.startTime}" às ` +
        `"${bloco.endTime}". Cadastre dois blocos, um em cada dia da semana.`,
    );
  }

  return { abre, fecha };
}

/** Corta o trecho nos limites pedidos; devolve `null` se não sobrar nada. */
function recortar(trecho: Trecho, inicio: number, fim: number): Trecho | null {
  const a = Math.max(trecho.inicio, inicio);
  const b = Math.min(trecho.fim, fim);
  return b > a ? { inicio: a, fim: b } : null;
}

/** Funde trechos que se tocam ou se sobrepõem, para nada ser contado duas vezes. */
function unir(trechos: Trecho[]): Trecho[] {
  const ordenados = [...trechos].sort((x, y) => x.inicio - y.inicio);
  const saida: Trecho[] = [];

  for (const t of ordenados) {
    const ultimo = saida.at(-1);
    if (ultimo && t.inicio <= ultimo.fim) ultimo.fim = Math.max(ultimo.fim, t.fim);
    else saida.push({ ...t });
  }

  return saida;
}

/** `base` menos `remover` — só a parte que intersecta sai, o resto fica. */
function subtrair(base: Trecho[], remover: Trecho[]): Trecho[] {
  let atual = base;

  for (const r of remover) {
    const proximo: Trecho[] = [];
    for (const t of atual) {
      if (r.fim <= t.inicio || r.inicio >= t.fim) {
        proximo.push(t);
        continue;
      }
      if (r.inicio > t.inicio) proximo.push({ inicio: t.inicio, fim: r.inicio });
      if (r.fim < t.fim) proximo.push({ inicio: r.fim, fim: t.fim });
    }
    atual = proximo;
  }

  return atual;
}

/**
 * Quebra um trecho nas viradas de hora **local**, para o gráfico por hora.
 *
 * A virada vem do Luxon e não de `ms % 3_600_000`: fuso de meia hora e virada
 * de horário de verão fazem a hora cheia cair fora do múltiplo de 3.600.000.
 */
function fatiarPorHora(trecho: Trecho, timeZone: string): { hora: number; ms: number }[] {
  const fatias: { hora: number; ms: number }[] = [];
  let cursor = trecho.inicio;

  while (cursor < trecho.fim) {
    const dt = DateTime.fromMillis(cursor, { zone: timeZone });
    const proxima = dt.startOf('hour').plus({ hours: 1 }).toMillis();
    const limite = Math.min(proxima, trecho.fim);
    // Fuso inválido tornaria `proxima` NaN e o laço eterno; sai pela porta.
    if (!(limite > cursor)) break;
    fatias.push({ hora: dt.hour, ms: limite - cursor });
    cursor = limite;
  }

  return fatias;
}

/** Soma num acumulador de `Map`, criando a chave zerada na primeira vez. */
function somar<K>(mapa: Map<K, { disponiveis: number; ocupados: number }>, chave: K, campo: 'disponiveis' | 'ocupados', ms: number): void {
  const atual = mapa.get(chave) ?? { disponiveis: 0, ocupados: 0 };
  atual[campo] += ms;
  mapa.set(chave, atual);
}

/** Ocupação sobre disponibilidade. Sem denominador não há taxa — `null`, nunca `NaN` nem `0`. */
function taxaDe(ocupados: number, disponiveis: number): number | null {
  return disponiveis > 0 ? ocupados / disponiveis : null;
}

/**
 * O recorte por dia e por hora sempre tem denominador: as chaves desses mapas
 * só nascem a partir de um trecho **disponível**, então o `null` de `taxaDe` é
 * inalcançável ali. O `?? 0` existe para o tipo, não para o caso.
 */
function taxaDoRecorte(ocupados: number, disponiveis: number): number {
  return taxaDe(ocupados, disponiveis) ?? 0;
}

export function calcularOcupacao(args: CalcularOcupacaoArgs): Ocupacao {
  const { itens, expediente, bloqueios, janela, timeZone, agora } = args;

  const inicioJanela = janela.inicio.getTime();
  // Regra 3: o futuro não é ociosidade. O corte vale para o numerador também —
  // agendamento de amanhã não pode ocupar um tempo que ainda não foi vendido.
  const fimJanela = Math.min(janela.fim.getTime(), agora.getTime());

  const disponiveis: TrechoDisponivel[] = [];

  if (fimJanela > inicioJanela && expediente.length > 0) {
    const bloqueiosPorStaff = new Map<string, Trecho[]>();
    for (const b of bloqueios) {
      const trecho = { inicio: b.startAt.getTime(), fim: b.endAt.getTime() };
      if (trecho.fim <= trecho.inicio) continue;
      bloqueiosPorStaff.set(b.staffId, [...(bloqueiosPorStaff.get(b.staffId) ?? []), trecho]);
    }

    const ultimoDia = DateTime.fromMillis(fimJanela, { zone: timeZone });
    let dia = DateTime.fromMillis(inicioJanela, { zone: timeZone }).startOf('day');

    while (dia <= ultimoDia) {
      const doDia = expediente.filter((b) => b.weekday === dia.weekday);

      // Regra 1 + regra 4: dia sem bloco de expediente simplesmente não entra.
      if (doDia.length > 0) {
        const porStaff = new Map<string, Trecho[]>();

        for (const bloco of doDia) {
          const { abre, fecha } = instantesDoBloco(dia, bloco);

          const dentro = recortar(
            { inicio: abre.toMillis(), fim: fecha.toMillis() },
            inicioJanela,
            fimJanela,
          );
          if (!dentro) continue;

          porStaff.set(bloco.staffId, [...(porStaff.get(bloco.staffId) ?? []), dentro]);
        }

        for (const [staffId, trechos] of porStaff) {
          // Une antes de subtrair: dois blocos sobrepostos no cadastro contariam
          // o mesmo minuto duas vezes e inflariam o denominador.
          const livres = subtrair(unir(trechos), bloqueiosPorStaff.get(staffId) ?? []);
          for (const t of livres) {
            disponiveis.push({ ...t, staffId, weekday: dia.weekday });
          }
        }
      }

      dia = dia.plus({ days: 1 }).startOf('day');
    }
  }

  // O numerador é unido por barbeiro antes de cruzar com o expediente: dois
  // atendimentos sobrepostos na mesma cadeira (encaixe por cima) ocupam o
  // mesmo minuto uma vez só, senão a taxa passaria de 100%.
  const ocupadoPorStaff = new Map<string, Trecho[]>();
  for (const i of itens) {
    if (!OCUPAM.has(i.status)) continue;
    const trecho = { inicio: i.startAt.getTime(), fim: i.endAt.getTime() };
    if (trecho.fim <= trecho.inicio) continue;
    ocupadoPorStaff.set(i.staffId, [...(ocupadoPorStaff.get(i.staffId) ?? []), trecho]);
  }
  for (const [staffId, trechos] of ocupadoPorStaff) {
    ocupadoPorStaff.set(staffId, unir(trechos));
  }

  let msDisponiveis = 0;
  let msOcupados = 0;
  const porBarbeiro = new Map<string, { disponiveis: number; ocupados: number }>();
  const porDia = new Map<number, { disponiveis: number; ocupados: number }>();
  const porHora = new Map<number, { disponiveis: number; ocupados: number }>();

  for (const trecho of disponiveis) {
    const duracao = trecho.fim - trecho.inicio;
    msDisponiveis += duracao;
    somar(porBarbeiro, trecho.staffId, 'disponiveis', duracao);
    somar(porDia, trecho.weekday, 'disponiveis', duracao);
    for (const fatia of fatiarPorHora(trecho, timeZone)) {
      somar(porHora, fatia.hora, 'disponiveis', fatia.ms);
    }

    // O ocupado só conta dentro do disponível: atendimento que vaza do
    // expediente, cai em cima de um bloqueio ou está no futuro do dia em curso
    // entra pela parte que sobrepõe, e nada mais.
    for (const ocupado of ocupadoPorStaff.get(trecho.staffId) ?? []) {
      const dentro = recortar(ocupado, trecho.inicio, trecho.fim);
      if (!dentro) continue;

      const minutos = dentro.fim - dentro.inicio;
      msOcupados += minutos;
      somar(porBarbeiro, trecho.staffId, 'ocupados', minutos);
      somar(porDia, trecho.weekday, 'ocupados', minutos);
      for (const fatia of fatiarPorHora(dentro, timeZone)) {
        somar(porHora, fatia.hora, 'ocupados', fatia.ms);
      }
    }
  }

  const emMinutos = (ms: number) => ms / 60_000;

  return {
    minutosDisponiveis: emMinutos(msDisponiveis),
    minutosOcupados: emMinutos(msOcupados),
    taxa: taxaDe(msOcupados, msDisponiveis),
    porBarbeiro: new Map(
      [...porBarbeiro].map(([staffId, v]) => [
        staffId,
        {
          disponiveis: emMinutos(v.disponiveis),
          ocupados: emMinutos(v.ocupados),
          taxa: taxaDe(v.ocupados, v.disponiveis),
        },
      ]),
    ),
    porDiaDaSemana: [...porDia]
      .sort(([a], [b]) => a - b)
      .map(([weekday, v]) => ({ weekday, taxa: taxaDoRecorte(v.ocupados, v.disponiveis) })),
    porHora: [...porHora]
      .sort(([a], [b]) => a - b)
      .map(([hora, v]) => ({ hora, taxa: taxaDoRecorte(v.ocupados, v.disponiveis) })),
  };
}
