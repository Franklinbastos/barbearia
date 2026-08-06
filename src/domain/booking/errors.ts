export class SlotUnavailableError extends Error {
  readonly code = 'SLOT_UNAVAILABLE';
  constructor(message = 'Esse horário não está mais disponível') {
    super(message);
    this.name = 'SlotUnavailableError';
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

/** O Postgres devolve 23P01 quando a constraint EXCLUDE recusa a inserção. */
export function isExclusionViolation(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && 'code' in erro && (erro as { code: unknown }).code === '23P01';
}
