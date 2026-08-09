/** Bloco de expediente, em minutos desde 00:00 no fuso da barbearia. */
export type WorkingBlock = { startMinute: number; endMinute: number };

/** Intervalo ocupado (agendamento ou bloqueio), em instantes absolutos. */
export type Busy = { start: Date; end: Date };

/**
 * Horário oferecido ao cliente. Na grade, `end` já inclui o arredondamento
 * para slots inteiros; no encaixe nas pontas é a duração real do serviço,
 * que é o que faz o horário caber no espaço que sobrou.
 */
export type Slot = { start: Date; end: Date };

export type AvailabilityInput = {
  /** Dia no formato YYYY-MM-DD, no calendário local da barbearia. */
  date: string;
  timeZone: string;
  slotMinutes: number;
  minLeadMinutes: number;
  /** Duração real do serviço; a ocupação é arredondada para cima em slots inteiros. */
  serviceDurationMinutes: number;
  workingBlocks: WorkingBlock[];
  busy: Busy[];
  now: Date;
};
