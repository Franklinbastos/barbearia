/**
 * Erros de negócio do domínio de agendamento têm um `code` estável e público
 * (ver `domain/booking/errors.ts`). A casca reconhece esses erros pelo `code`,
 * não por `instanceof`: a identidade de classe atravessa mal fronteiras de
 * módulo (bundlers de edge, mocks de teste), o `code` não. Um erro sem code
 * conhecido (falha de banco, bug) não é de negócio e deve subir, virar 500 e
 * aparecer no log — nunca ser engolido como "horário indisponível".
 */
const CODIGOS_DE_NEGOCIO = new Set([
  'NOT_FOUND',
  'SLOT_UNAVAILABLE',
  'OUTSIDE_BOOKING_WINDOW',
  'SLOT_TAKEN',
  'CANCEL_NOT_ALLOWED',
]);

export type ErroDeNegocio = { code: string; message: string };

/** Se o erro for de negócio (code conhecido), devolve code+mensagem; senão null. */
export function comoErroDeNegocio(erro: unknown): ErroDeNegocio | null {
  if (erro instanceof Error) {
    const code = (erro as { code?: unknown }).code;
    if (typeof code === 'string' && CODIGOS_DE_NEGOCIO.has(code)) {
      return { code, message: erro.message };
    }
  }
  return null;
}
