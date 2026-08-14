import { DateTime } from 'luxon';

/**
 * A janela de tempo dos indicadores (§5 do spec).
 *
 * **É a base de tudo.** Todo número da tela de resumo — faturamento, ocupação,
 * falta, comissão — sai de uma lista de atendimentos filtrada por esta janela.
 * Se ela estiver deslocada em um dia, todos os números ficam errados juntos, e
 * nenhum teste dos outros módulos acusa: eles recebem a janela pronta. Por isso
 * a matemática do período mora sozinha aqui, sem I/O, com teste próprio.
 *
 * **Duas regras que não mudam:**
 *
 * 1. **O dia é o civil da barbearia.** "Hoje" é o dia que a loja está vivendo,
 *    não as últimas 24 horas nem o dia do relógio do servidor. Tudo passa por
 *    `setZone(timeZone)` do Luxon. Nunca `new Date('2026-08-13')` (o padrão lê
 *    como meia-noite UTC, e em São Paulo isso é dia 12) nem
 *    `toISOString().slice(0, 10)` (que devolve o dia em UTC, e às 21h em São
 *    Paulo já é o dia seguinte).
 *
 * 2. **O `fim` é exclusivo** — meia-noite do dia seguinte ao último dia da
 *    janela. É a mesma convenção de `listAppointmentsBetween`, e é o que faz o
 *    corte das 18h do último dia entrar na conta. Um `fim` inclusivo à
 *    meia-noite perderia o dia inteiro de trabalho da última data escolhida.
 */
export type Periodo = 'hoje' | 'semana' | 'mes' | 'livre';

export type Janela = {
  /** Instante do primeiro momento da janela, inclusivo. */
  inicio: Date;
  /** Instante logo depois do último momento da janela, **exclusivo**. */
  fim: Date;
  /** Como a tela chama esta janela: "10 a 16 de agosto", "agosto de 2026". */
  rotulo: string;
  periodo: Periodo;
};

export type ResolverPeriodoParams = {
  /** O `?periodo=` da URL. Qualquer coisa fora da lista cai na semana. */
  periodo?: string;
  /** `YYYY-MM-DD` no fuso da loja — só vale com `periodo=livre`. */
  de?: string;
  /** `YYYY-MM-DD` no fuso da loja, **inclusivo** — só vale com `periodo=livre`. */
  ate?: string;
  timeZone: string;
  /** Injetável para o teste; em produção é o relógio, já no fuso da loja. */
  agora?: DateTime;
};

const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** "sexta, 14 de agosto" — sem o "-feira", como o `formatDayLabelLong`. */
function rotuloDoDia(dia: DateTime): string {
  return dia
    .setLocale('pt-BR')
    .toLocaleString({ weekday: 'long', day: 'numeric', month: 'long' })
    .replace('-feira', '');
}

/**
 * O rótulo de uma janela, a partir do primeiro dia e do **último dia
 * inclusivo** — nunca do `fim` exclusivo, que apontaria para o dia seguinte e
 * diria "10 a 17 de agosto" numa semana que acaba no dia 16.
 *
 * Repete o mês só quando ele muda, e o ano só quando a janela cruza a virada:
 * "10 a 16 de agosto" cabe no seletor, "10 de agosto de 2026 a 16 de agosto de
 * 2026" não.
 */
function rotuloDeIntervalo(inicio: DateTime, ultimoDia: DateTime): string {
  const pt = (d: DateTime) => d.setLocale('pt-BR');

  if (inicio.hasSame(ultimoDia, 'day')) return rotuloDoDia(inicio);

  if (inicio.year !== ultimoDia.year) {
    const a = pt(inicio).toLocaleString({ day: 'numeric', month: 'long', year: 'numeric' });
    const b = pt(ultimoDia).toLocaleString({ day: 'numeric', month: 'long', year: 'numeric' });
    return `${a} a ${b}`;
  }

  if (inicio.month !== ultimoDia.month) {
    const a = pt(inicio).toLocaleString({ day: 'numeric', month: 'long' });
    const b = pt(ultimoDia).toLocaleString({ day: 'numeric', month: 'long' });
    return `${a} a ${b}`;
  }

  return `${inicio.day} a ${pt(ultimoDia).toLocaleString({ day: 'numeric', month: 'long' })}`;
}

/** Monta a janela e o rótulo a partir das duas pontas, com o `fim` exclusivo. */
function montarJanela(inicio: DateTime, fim: DateTime, periodo: Periodo): Janela {
  const rotulo =
    periodo === 'mes'
      ? inicio.setLocale('pt-BR').toLocaleString({ month: 'long', year: 'numeric' })
      : rotuloDeIntervalo(inicio, fim.minus({ days: 1 }));

  return { inicio: inicio.toJSDate(), fim: fim.toJSDate(), rotulo, periodo };
}

/** `YYYY-MM-DD` → meia-noite daquele dia no fuso da loja, ou `null` se não for dia. */
function diaDaLoja(iso: string | undefined, timeZone: string): DateTime | null {
  if (!iso || !DIA_ISO.test(iso)) return null;
  const dia = DateTime.fromISO(iso, { zone: timeZone });
  return dia.isValid ? dia.startOf('day') : null;
}

/**
 * Resolve o que veio na URL numa janela concreta.
 *
 * A semana é o padrão porque é a cadência que o setor recomenda para o dono
 * olhar — e ela começa na **segunda**: `startOf('week')` do Luxon é ISO, e a
 * segunda é onde a semana da barbearia começa de verdade (domingo quase toda
 * loja está fechada).
 *
 * Nada aqui lança. Período desconhecido, `de`/`ate` faltando ou mal formados e
 * intervalo invertido são todos corrigidos: é URL que o usuário edita à mão e
 * que o navegador guarda no histórico, e uma tela de indicadores que explode
 * com `?periodo=trimestre` é pior do que uma que mostra a semana.
 */
export function resolverPeriodo(params: ResolverPeriodoParams): Janela {
  const { periodo, de, ate, timeZone } = params;
  const agora = (params.agora ?? DateTime.now()).setZone(timeZone);

  if (periodo === 'livre') {
    const a = diaDaLoja(de, timeZone);
    const b = diaDaLoja(ate, timeZone);
    if (a && b) {
      // Invertido é corrigido em vez de devolver janela vazia: quem escolheu as
      // duas pontas na ordem trocada quis o intervalo entre elas, e uma tela
      // zerada pareceria uma barbearia parada.
      const [inicio, ultimoDia] = a.toMillis() <= b.toMillis() ? [a, b] : [b, a];
      return montarJanela(inicio, ultimoDia.plus({ days: 1 }), 'livre');
    }
    // Sem as duas pontas não há intervalo nenhum — cai na semana.
  }

  if (periodo === 'hoje') {
    const inicio = agora.startOf('day');
    return montarJanela(inicio, inicio.plus({ days: 1 }), 'hoje');
  }

  if (periodo === 'mes') {
    const inicio = agora.startOf('month');
    return montarJanela(inicio, inicio.plus({ months: 1 }), 'mes');
  }

  const inicio = agora.startOf('week');
  return montarJanela(inicio, inicio.plus({ weeks: 1 }), 'semana');
}

/**
 * O período imediatamente anterior, para a comparação dos cards.
 *
 * Anda em **unidade de calendário**, não em milissegundos: o mês anterior a
 * março é fevereiro com os seus 28 dias, e não "março menos 30 dias", que
 * começaria no dia 30 de janeiro e contaria dois pedaços de mês. Pela mesma
 * razão a semana anterior é `minus({ weeks: 1 })` e não `- 7 × 24 h` — no dia
 * da virada de horário de verão as duas contas divergem em uma hora, e a
 * comparação passaria a ter uma hora a mais de expediente de um lado.
 *
 * O `fim` da janela anterior é sempre o `inicio` da atual: os dois períodos se
 * encostam sem buraco nem sobreposição.
 */
export function janelaAnterior(janela: Janela, timeZone: string): Janela {
  const fim = DateTime.fromJSDate(janela.inicio).setZone(timeZone);

  if (janela.periodo === 'mes') {
    return montarJanela(fim.minus({ months: 1 }).startOf('month'), fim, 'mes');
  }

  if (janela.periodo === 'hoje') {
    return montarJanela(fim.minus({ days: 1 }), fim, 'hoje');
  }

  if (janela.periodo === 'semana') {
    return montarJanela(fim.minus({ weeks: 1 }), fim, 'semana');
  }

  // Intervalo livre: recua a mesma quantidade de dias que ele cobre. Os dois
  // extremos são meia-noite no fuso da loja, então a diferença é inteira.
  const dias = Math.max(
    1,
    Math.round(DateTime.fromJSDate(janela.fim).setZone(timeZone).diff(fim, 'days').days),
  );
  return montarJanela(fim.minus({ days: dias }), fim, 'livre');
}
