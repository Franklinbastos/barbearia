export class SlotUnavailableError extends Error {
  readonly code: string = 'SLOT_UNAVAILABLE';
  constructor(message = 'Esse horário não está mais disponível') {
    super(message);
    this.name = 'SlotUnavailableError';
  }
}

/**
 * Dia além de hoje + `maxAdvanceDays` (no fuso da barbearia). Herda de
 * `SlotUnavailableError` de propósito: `lib/api-error.ts` já traduz essa
 * família para 409 e o front público trata 409 recarregando a grade, então a
 * regra passa a valer no servidor sem mexer em arquivo de fora do domínio.
 * O `code` próprio deixa o cliente distinguir "dia fechado" de "horário tomado".
 */
export class OutsideBookingWindowError extends SlotUnavailableError {
  readonly code = 'OUTSIDE_BOOKING_WINDOW';
  constructor(message = 'Esse dia ainda não está aberto para agendamento') {
    super(message);
    this.name = 'OutsideBookingWindowError';
  }
}

/**
 * Cancelamento recusado por causa do estado do agendamento: já começou, já foi
 * concluído ou já foi marcado como falta. Vale só para o link do cliente — o
 * painel cancela mesmo assim (ver `cancel-appointment.ts`).
 */
export class CancelNotAllowedError extends Error {
  readonly code = 'CANCEL_NOT_ALLOWED';
  constructor(message = 'Esse agendamento não pode mais ser cancelado por aqui') {
    super(message);
    this.name = 'CancelNotAllowedError';
  }
}

export class SlotTakenError extends Error {
  readonly code = 'SLOT_TAKEN';
  constructor(message = 'Esse horário acabou de ser preenchido') {
    super(message);
    this.name = 'SlotTakenError';
  }
}

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  constructor(message = 'Registro não encontrado') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** Profundidade máxima da cadeia de `cause`, para não travar em ciclo. */
const MAX_CAUSAS = 10;

/**
 * O Postgres devolve 23P01 quando a constraint EXCLUDE recusa a inserção.
 * O Drizzle embrulha o erro do driver num `DrizzleQueryError`, então o código
 * não fica na superfície: é preciso percorrer a cadeia de `cause`.
 */
export function isExclusionViolation(erro: unknown): boolean {
  let atual: unknown = erro;
  for (let nivel = 0; atual != null && nivel < MAX_CAUSAS; nivel += 1) {
    if (
      typeof atual === 'object' &&
      'code' in atual &&
      (atual as { code: unknown }).code === '23P01'
    ) {
      return true;
    }
    atual = (atual as { cause?: unknown }).cause;
  }
  return false;
}
