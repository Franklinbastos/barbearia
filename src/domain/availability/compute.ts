import { DateTime } from 'luxon';
import type { AvailabilityInput, Busy, Slot, WorkingBlock } from './types';

export function parseTimeToMinutes(time: string): number {
  const [hora, minuto] = time.split(':');
  return Number(hora) * 60 + Number(minuto);
}

function localMinuteToDate(date: string, timeZone: string, minute: number): Date | null {
  const hora = String(Math.floor(minute / 60)).padStart(2, '0');
  const min = String(minute % 60).padStart(2, '0');
  const dt = DateTime.fromISO(`${date}T${hora}:${min}`, { zone: timeZone });
  if (!dt.isValid) return null;
  if (dt.hour !== Number(hora) || dt.minute !== Number(min)) return null;
  return dt.toJSDate();
}

/**
 * Caminho inverso do `localMinuteToDate`: o minuto do relógio de parede de um
 * instante, contado desde 00:00 do dia `date`, para comparar com os limites do
 * bloco de expediente.
 *
 * Instante do dia seguinte devolve valor acima de 1440 e o do dia anterior,
 * negativo — assim a comparação com o bloco continua valendo quando o
 * atendimento vaza a meia-noite, em vez de o horário ser confundido com
 * madrugada. Segundos entram como fração porque um bloqueio pode não estar no
 * minuto cheio, e meio minuto para fora do expediente ainda é para fora.
 */
function dateToLocalMinute(date: string, timeZone: string, instante: Date): number | null {
  const dt = DateTime.fromJSDate(instante, { zone: timeZone });
  if (!dt.isValid) return null;
  const minutoDoDia = dt.hour * 60 + dt.minute + dt.second / 60 + dt.millisecond / 60_000;
  if (dt.toISODate() === date) return minutoDoDia;

  const meiaNoite = DateTime.fromISO(date, { zone: timeZone }).startOf('day');
  if (!meiaNoite.isValid) return null;
  // Diferença em dias de calendário: 24 horas fixas erram justamente no dia da
  // virada do horário de verão, que é o dia que esta conta existe para tratar.
  const dias = dt.startOf('day').diff(meiaNoite, 'days').days;
  return dias * 1440 + minutoDoDia;
}

/**
 * Candidatos da segunda passagem para um bloco: o horário encostado no início
 * e o encostado no fim de cada espaço livre.
 *
 * Não é preciso montar a lista de espaços. Todo espaço livre começa no início
 * do bloco ou no fim de algum ocupado, e termina no fim do bloco ou no início
 * de algum ocupado — então essas quatro bordas geram todos os candidatos que
 * existem. Borda que não delimita espaço de verdade (ocupado dentro de outro,
 * ocupados encostados) produz candidato que colide ou sai do bloco, e morre
 * nos mesmos filtros que valem para todo mundo.
 */
function pontasDoBloco(
  bloco: WorkingBlock,
  busy: Busy[],
  duracaoMinutos: number,
  date: string,
  timeZone: string,
): Date[] {
  /** Sobe para o minuto cheio seguinte; já cheio, fica onde está. */
  function proximoMinutoCheio(instante: Date): Date {
    const resto = instante.getTime() % 60_000;
    return resto === 0 ? instante : new Date(instante.getTime() + (60_000 - resto));
  }

  /** Desce para o minuto cheio anterior; já cheio, fica onde está. */
  function minutoCheioAnterior(instante: Date): Date {
    return new Date(instante.getTime() - (instante.getTime() % 60_000));
  }

  const candidatos: Date[] = [];
  const duracaoMs = duracaoMinutos * 60_000;

  const inicioDoBloco = localMinuteToDate(date, timeZone, bloco.startMinute);
  if (inicioDoBloco) candidatos.push(inicioDoBloco);

  const encostadoNoFimDoBloco = localMinuteToDate(
    date, timeZone, bloco.endMinute - duracaoMinutos,
  );
  if (encostadoNoFimDoBloco) candidatos.push(encostadoNoFimDoBloco);

  for (const ocupado of busy) {
    // O espaço que começa quando o ocupado termina: o rabo que um encaixe
    // anterior deixou fora da grade. Sobe para o minuto cheio seguinte — um
    // ocupado que termina 13:15:37 não pode virar um horário "13:15" na tela e
    // 13:15:37 no banco, e arredondar para baixo o faria colidir.
    candidatos.push(proximoMinutoCheio(ocupado.end));
    // E o que termina quando o ocupado começa. Aqui desce para o minuto cheio
    // anterior, senão o atendimento invadiria o ocupado por alguns segundos.
    candidatos.push(new Date(minutoCheioAnterior(ocupado.start).getTime() - duracaoMs));
  }

  return candidatos;
}

export function computeAvailability(input: AvailabilityInput): Slot[] {
  const {
    date, timeZone, slotMinutes, minLeadMinutes,
    serviceDurationMinutes, workingBlocks, busy, now,
  } = input;

  if (!Number.isInteger(slotMinutes) || slotMinutes <= 0) {
    throw new Error('slotMinutes deve ser um inteiro maior que zero');
  }
  if (!Number.isInteger(serviceDurationMinutes) || serviceDurationMinutes <= 0) {
    throw new Error('A duração do serviço deve ser um inteiro maior que zero');
  }

  const slotsNecessarios = Math.ceil(serviceDurationMinutes / slotMinutes);
  const ocupacaoMinutos = slotsNecessarios * slotMinutes;
  const maisCedo = new Date(now.getTime() + minLeadMinutes * 60_000);
  const colide = (start: Date, end: Date) => busy.some((b) => start < b.end && b.start < end);

  /**
   * O atendimento inteiro tem que caber dentro do bloco, do começo ao fim —
   * nada de emendar por cima do almoço nem de varar o fim do expediente.
   *
   * O fim é medido no relógio de parede do próprio instante final, e não
   * somando a duração em minutos locais em cima do início. No dia em que o
   * relógio adianta, o ponteiro anda 60 minutos a mais que o tempo real: um
   * serviço de 168 minutos começando 01:02 termina 04:50, não 03:50, e a soma
   * local o daria como cabendo num bloco que fecha 03:59.
   */
  const cabeNoBloco = (start: Date, end: Date, bloco: WorkingBlock) => {
    const minutoInicio = dateToLocalMinute(date, timeZone, start);
    const minutoFim = dateToLocalMinute(date, timeZone, end);
    if (minutoInicio === null || minutoFim === null) return false;
    return minutoInicio >= bloco.startMinute && minutoFim <= bloco.endMinute;
  };

  const slots: Slot[] = [];
  const jaOferecidos = new Set<number>();

  const oferecer = (start: Date, duracaoMinutos: number, bloco: WorkingBlock) => {
    if (jaOferecidos.has(start.getTime())) return;
    const end = new Date(start.getTime() + duracaoMinutos * 60_000);
    if (!cabeNoBloco(start, end, bloco)) return;
    if (start < maisCedo) return;
    if (colide(start, end)) return;
    slots.push({ start, end });
    jaOferecidos.add(start.getTime());
  };

  // Passagem 1 — a grade. Caminha de `slotMinutes` em `slotMinutes` a partir
  // do início do bloco, ocupando slots inteiros para manter a agenda alinhada.
  // A condição do laço é só o limite da caminhada; quem decide se o horário
  // cabe é o `cabeNoBloco`, dentro do `oferecer`.
  for (const bloco of workingBlocks) {
    for (
      let offset = bloco.startMinute;
      offset + ocupacaoMinutos <= bloco.endMinute;
      offset += slotMinutes
    ) {
      const start = localMinuteToDate(date, timeZone, offset);
      if (!start) continue;
      oferecer(start, ocupacaoMinutos, bloco);
    }
  }

  // Passagem 2 — o encaixe nas pontas de cada espaço livre. Aqui a ocupação é
  // a duração real do serviço, não a arredondada: o arredondamento existe para
  // manter a grade alinhada, e a ponta já nasce fora da grade. É o que faz o
  // exemplo do spec funcionar — espaço das 15:00 às 16:00 com serviço de 45
  // oferece 15:00 e 15:15; com a duração arredondada para 60 as duas pontas
  // cairiam nas 15:00 e o cliente que só chega 15:05 continuaria sem horário.
  for (const bloco of workingBlocks) {
    const candidatos = pontasDoBloco(bloco, busy, serviceDurationMinutes, date, timeZone);

    for (const start of candidatos) {
      // A antecedência mínima vale igual para a ponta (§3.4 do spec): quem a
      // ignora é o encaixe do balcão, que não passa por aqui.
      oferecer(start, serviceDurationMinutes, bloco);
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}
