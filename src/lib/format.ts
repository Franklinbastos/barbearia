export function formatPrice(cents: number): string {
  if (cents === 0) return 'Grátis';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(cents / 100)
    .replace(/ /g, ' ');
}

/**
 * Dinheiro com centavo — o formato de quem **confere**.
 *
 * Não é o `formatPrice`: aquele devolve "Grátis" no zero, que é certo para
 * preço de serviço e absurdo para faturamento de uma semana parada ou para uma
 * comissão de R$ 0,00. A comissão é o número que o barbeiro confere com o dedo
 * na tela, e centavo escondido ali é divergência no fechamento.
 */
export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(cents / 100)
    .replace(/\u00A0/g, ' ');
}

/**
 * Dinheiro sem centavo — o formato de quem **decide**.
 *
 * No card de faturamento o centavo é ruído: o dono lê "R$ 4.532" e segue. Os
 * dois formatos convivem de propósito, e ficam lado a lado aqui para que a
 * diferença seja escolha e não acidente — eles já divergiram em silêncio, cada
 * um copiado numa tela.
 */
export function formatMoneyRounded(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
    .format(cents / 100)
    .replace(/\u00A0/g, ' ');
}

/**
 * Fração de 0 a 1 → "68%". Inteiro: casa decimal em taxa de ocupação é ruído.
 *
 * Só recebe número. Denominador vazio não é zero por cento, é ausência de taxa,
 * e quem trata isso é a tela — com traço (§5.12 da direção de UI).
 */
export function formatPercent(fracao: number): string {
  return `${Math.round(fracao * 100)}%`;
}

export function formatDuration(minutes: number): string {
  const horas = Math.floor(minutes / 60);
  const resto = minutes % 60;
  if (horas === 0) return `${resto} min`;
  if (resto === 0) return `${horas} h`;
  return `${horas} h ${resto} min`;
}

/**
 * Hora no fuso da barbearia. Aceita o ISO que vem da API pública e o `Date`
 * que vem do banco — nos dois casos o fuso do servidor é irrelevante.
 */
export function formatTime(instante: string | Date, timeZone: string): string {
  const data = instante instanceof Date ? instante : new Date(instante);
  return data.toLocaleTimeString('pt-BR', {
    timeZone, hour: '2-digit', minute: '2-digit',
  });
}

export function formatDayLabel(isoDate: string, timeZone: string): string {
  const data = new Date(`${isoDate}T12:00:00Z`);
  return data
    .toLocaleDateString('pt-BR', { timeZone, weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/\.$/, '');
}

/**
 * As três partes do dia que a tira de dias mostra empilhadas: `SEG` / `10` /
 * `ago`. Separadas porque a tira usa três tamanhos de tipo, não uma frase.
 */
export function formatDayParts(
  isoDate: string,
  timeZone: string,
): { diaSemana: string; dia: string; mes: string } {
  const data = new Date(`${isoDate}T12:00:00Z`);
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone, weekday: 'short', day: '2-digit', month: 'short',
  }).formatToParts(data);

  const pegar = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value.replace(/\.$/, '') ?? '';

  return {
    diaSemana: pegar('weekday').toUpperCase(),
    dia: pegar('day'),
    mes: pegar('month'),
  };
}

/**
 * Dia por extenso — "sexta, 14 de agosto". Sem o "-feira": o cabeçalho da grade
 * de horários é estreito e "sexta-feira" empurra a data para a segunda linha.
 */
export function formatDayLabelLong(isoDate: string, timeZone: string): string {
  const data = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone, weekday: 'long', day: 'numeric', month: 'long',
  })
    .format(data)
    .replace('-feira', '');
}

/**
 * Dia civil (`YYYY-MM-DD`) do instante **no fuso da barbearia**.
 *
 * É o substituto de `iso.slice(0, 10)`: aquele corte lê a data em UTC, então
 * um agendamento das 21:30 em São Paulo aparecia no dia seguinte.
 */
export function isoDateInZone(instante: string | Date, timeZone: string): string {
  const data = instante instanceof Date ? instante : new Date(instante);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data);
}

/** Rótulo curto do dia de um instante, já convertido para o fuso da barbearia. */
export function formatDayLabelFromInstant(instante: string | Date, timeZone: string): string {
  return formatDayLabel(isoDateInZone(instante, timeZone), timeZone);
}

/** Data e hora completas no fuso da barbearia. Nunca depende do fuso do servidor. */
export function formatDateTime(instante: string | Date, timeZone: string): string {
  const data = instante instanceof Date ? instante : new Date(instante);
  return data.toLocaleString('pt-BR', { timeZone, dateStyle: 'short', timeStyle: 'short' });
}

export type AppointmentStatus = 'BOOKED' | 'DONE' | 'CANCELED' | 'NO_SHOW';

const ROTULO_STATUS: Record<AppointmentStatus, string> = {
  BOOKED: 'Agendado',
  DONE: 'Compareceu',
  CANCELED: 'Cancelado',
  NO_SHOW: 'Não veio',
};

/** Único ponto de tradução dos estados de agendamento — o enum do banco não vai para a tela. */
export function formatAppointmentStatus(status: AppointmentStatus): string {
  return ROTULO_STATUS[status];
}
